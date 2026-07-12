<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ImageResource;
use App\Models\Image;
use App\Services\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ImageController extends Controller
{
    /** Formats acceptés et taille max (Ko) d'une image de la bibliothèque. */
    private const MIMES = 'jpeg,jpg,png,webp,gif';
    private const MAX_KB = 5120; // 5 Mo

    public function index(Request $request): AnonymousResourceCollection
    {
        $images = $request->user()->images()->latest()->get();

        return ImageResource::collection($images)->additional([
            'meta' => $this->quota($request),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $plan = $user->plan ?? 'free';

        abort_if(
            $user->images()->count() >= PlanLimits::maxImages($plan),
            403,
            "Limite d'images atteinte pour votre plan.",
        );

        $request->validate([
            'file' => ['required', 'file', 'image', 'mimes:'.self::MIMES, 'max:'.self::MAX_KB],
        ]);

        $file = $request->file('file');

        // Deuxième plafond, indépendant du nombre : le poids cumulé.
        $maxBytes  = PlanLimits::maxStorageBytes($plan);
        $usedBytes = (int) $user->images()->sum('size');

        abort_if(
            $usedBytes + $file->getSize() > $maxBytes,
            403,
            'Espace de stockage insuffisant pour votre plan — supprimez une image.',
        );

        // Un dossier par utilisateur : évite les collisions et facilite le ménage.
        $path = $file->store("images/{$user->id}", 'public');

        $image = $user->images()->create([
            'disk'          => 'public',
            'path'          => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime'          => $file->getClientMimeType(),
            'size'          => $file->getSize(),
        ]);

        return (new ImageResource($image))
            ->additional(['meta' => $this->quota($request)])
            ->response()
            ->setStatusCode(201);
    }

    public function destroy(Request $request, Image $image): JsonResponse
    {
        abort_if($image->user_id !== $request->user()->id, 403);

        $image->deleteWithFile();

        return response()->json(['meta' => $this->quota($request)]);
    }

    /**
     * Compteurs affichés dans l'UI (« 7/10 images », « 12,3 Mo / 25 Mo »).
     * Un max à null signifie « illimité » (plans payants).
     */
    private function quota(Request $request): array
    {
        $user     = $request->user();
        $plan     = $user->plan ?? 'free';
        $maxCount = PlanLimits::maxImages($plan);
        $maxBytes = PlanLimits::maxStorageBytes($plan);

        return [
            'used'       => $user->images()->count(),
            'max'        => $maxCount === PHP_INT_MAX ? null : $maxCount,
            'used_bytes' => (int) $user->images()->sum('size'),
            'max_bytes'  => $maxBytes === PHP_INT_MAX ? null : $maxBytes,
        ];
    }
}
