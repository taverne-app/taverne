<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CodexPageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'campaign_id' => $this->campaign_id,
            'parent_id'   => $this->parent_id,
            'title'       => $this->title,
            'body'        => $this->body,
            'visibility'  => $this->visibility,
            'position'    => (int) $this->position,
            'last_editor' => $this->last_editor,
            'created_at'  => $this->created_at,
            'updated_at'  => $this->updated_at,
        ];
    }
}
