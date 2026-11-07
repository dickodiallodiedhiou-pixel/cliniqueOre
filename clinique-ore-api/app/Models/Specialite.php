<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Specialite extends Model
{
    use HasFactory;

    protected $table = 'specialites';

    protected $fillable = [
        'nom',
        'description',
        'actif',
    ];

    protected function casts(): array
    {
        return ['actif' => 'boolean'];
    }

    // Une spécialité est exercée par 0..* médecins (un médecin peut avoir plusieurs spécialités)
    public function medecins()
    {
        return $this->belongsToMany(Medecin::class, 'medecin_specialite');
    }
}
