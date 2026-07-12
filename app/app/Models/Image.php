<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Image extends Model
{
    protected $fillable = ['user_id', 'disk', 'path', 'original_name', 'mime', 'size'];

    protected $casts = ['size' => 'integer'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * URL publique servie par nginx via le symlink public/storage.
     */
    public function getUrlAttribute(): string
    {
        return Storage::disk($this->disk)->url($this->path);
    }

    /**
     * Supprime le fichier du disque en même temps que la ligne.
     */
    public function deleteWithFile(): void
    {
        Storage::disk($this->disk)->delete($this->path);
        $this->delete();
    }
}
