<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ImageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'url'           => $this->url,
            'original_name' => $this->original_name,
            'mime'          => $this->mime,
            'size'          => $this->size,
            'created_at'    => $this->created_at,
        ];
    }
}
