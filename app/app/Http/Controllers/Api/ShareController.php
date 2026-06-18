<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CampaignResource;
use App\Models\Campaign;

class ShareController extends Controller
{
    public function show(string $token): CampaignResource
    {
        $campaign = Campaign::where('share_token', $token)
            ->with(['characters', 'combatants'])
            ->firstOrFail();

        return new CampaignResource($campaign);
    }
}
