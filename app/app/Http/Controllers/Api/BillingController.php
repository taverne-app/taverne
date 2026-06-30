<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Stripe\Exception\SignatureVerificationException;
use Stripe\StripeClient;
use Stripe\Webhook;

class BillingController extends Controller
{
    private function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    /** POST /api/billing/checkout — create a Stripe Checkout session */
    public function createCheckoutSession(Request $request): JsonResponse
    {
        $request->validate([
            'plan' => ['required', 'string', 'in:adventurer,guild'],
        ]);

        $user   = $request->user();
        $stripe = $this->stripe();

        // Create or retrieve Stripe customer
        if (! $user->stripe_customer_id) {
            $customer = $stripe->customers->create([
                'email'    => $user->email,
                'name'     => $user->name,
                'metadata' => ['user_id' => $user->id],
            ]);
            $user->update(['stripe_customer_id' => $customer->id]);
        }

        $priceId = $request->input('plan') === 'guild'
            ? config('services.stripe.guild_price_id')
            : config('services.stripe.adventurer_price_id');

        $session = $stripe->checkout->sessions->create([
            'customer'             => $user->stripe_customer_id,
            'mode'                 => 'subscription',
            'line_items'           => [['price' => $priceId, 'quantity' => 1]],
            'success_url'          => config('app.frontend_url') . '/campaigns?upgraded=1',
            'cancel_url'           => config('app.frontend_url') . '/campaigns',
            'subscription_data'    => ['metadata' => ['user_id' => $user->id]],
        ]);

        return response()->json(['url' => $session->url]);
    }

    /** POST /api/billing/portal — create a Stripe Billing Portal session */
    public function createPortalSession(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user->stripe_customer_id, 422, 'Aucun abonnement actif.');

        $session = $this->stripe()->billingPortal->sessions->create([
            'customer'   => $user->stripe_customer_id,
            'return_url' => config('app.frontend_url') . '/campaigns',
        ]);

        return response()->json(['url' => $session->url]);
    }

    /** POST /api/billing/webhook — handle Stripe events (no auth) */
    public function handleWebhook(Request $request): Response
    {
        $secret = config('services.stripe.webhook_secret');

        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                $request->header('Stripe-Signature'),
                $secret
            );
        } catch (SignatureVerificationException) {
            abort(400, 'Invalid signature.');
        }

        match ($event->type) {
            'checkout.session.completed'    => $this->onCheckoutCompleted($event->data->object),
            'customer.subscription.updated' => $this->onSubscriptionUpdated($event->data->object),
            'customer.subscription.deleted' => $this->onSubscriptionDeleted($event->data->object),
            default                         => null,
        };

        return response('', 200);
    }

    private function onCheckoutCompleted(object $session): void
    {
        $user = $this->userByCustomer($session->customer);
        if (! $user) return;

        $user->update(['stripe_subscription_id' => $session->subscription]);
        $this->syncPlanFromSubscription($user, $session->subscription);
    }

    private function onSubscriptionUpdated(object $subscription): void
    {
        $user = $this->userByCustomer($subscription->customer);
        if (! $user) return;

        if (in_array($subscription->status, ['active', 'trialing'])) {
            $this->syncPlanFromSubscription($user, $subscription->id);
        } else {
            $user->update(['plan' => 'free', 'stripe_subscription_id' => null]);
        }
    }

    private function onSubscriptionDeleted(object $subscription): void
    {
        $user = $this->userByCustomer($subscription->customer);
        if (! $user) return;

        $user->update(['plan' => 'free', 'stripe_subscription_id' => null]);
    }

    private function syncPlanFromSubscription(User $user, string $subscriptionId): void
    {
        $subscription = $this->stripe()->subscriptions->retrieve($subscriptionId, [
            'expand' => ['items.data.price'],
        ]);

        $priceId = $subscription->items->data[0]->price->id ?? null;

        $plan = match ($priceId) {
            config('services.stripe.guild_price_id')       => 'guild',
            config('services.stripe.adventurer_price_id')  => 'adventurer',
            default                                         => 'free',
        };

        $user->update(['plan' => $plan]);
    }

    private function userByCustomer(string $customerId): ?User
    {
        return User::where('stripe_customer_id', $customerId)->first();
    }
}
