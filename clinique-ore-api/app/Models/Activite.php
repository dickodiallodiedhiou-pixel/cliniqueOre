<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Activite extends Model
{
    protected $table = 'activites';

    protected $fillable = ['user_id', 'action', 'cible_type', 'cible_id', 'details'];

    protected function casts(): array
    {
        return ['details' => 'array'];
    }

    public function auteur()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // Enregistre une action de l'administrateur dans le journal
    public static function enregistrer(?User $auteur, string $action, ?string $cibleType = null, ?int $cibleId = null, array $details = []): self
    {
        return self::create([
            'user_id' => $auteur?->id,
            'action' => $action,
            'cible_type' => $cibleType,
            'cible_id' => $cibleId,
            'details' => $details ?: null,
        ]);
    }
}
