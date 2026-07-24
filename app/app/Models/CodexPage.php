<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Une page du codex de campagne.
 *
 * La visibilité ne s'hérite PAS du parent : chaque page porte la sienne. Corollaire
 * qui compte plus qu'il n'en a l'air — une page 'mj' n'apparaît pas du tout chez les
 * joueurs, pas même en grisé. Savoir qu'un secret existe, et où il se range dans
 * l'arbre, c'est déjà l'éventer.
 */
class CodexPage extends Model
{
    use SoftDeletes;

    /** MJ seul, ou toute la table. Les joueurs n'écrivent jamais que du 'table'. */
    public const VISIBILITIES = ['mj', 'table'];

    protected $fillable = [
        'campaign_id', 'parent_id', 'title', 'body', 'visibility', 'position', 'last_editor',
    ];

    protected $casts = [
        'position' => 'integer',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('position')->orderBy('id');
    }

    /**
     * Supprime la page et sa descendance. La cascade de la clé étrangère ne joue qu'à
     * la suppression réelle : sans ce parcours, une suppression douce laisserait des
     * enfants rattachés à un parent devenu invisible, donc introuvables dans l'arbre.
     */
    public function deleteWithDescendants(): void
    {
        foreach ($this->children as $child) {
            $child->deleteWithDescendants();
        }

        $this->delete();
    }
}
