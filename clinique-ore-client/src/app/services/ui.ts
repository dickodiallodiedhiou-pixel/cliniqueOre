// Petits utilitaires d'affichage
export function libelleRdv(statut: string): string {
  const map: Record<string, string> = {
    en_attente: 'En attente',
    confirme: 'Confirmé',
    annule: 'Annulé',
    termine: 'Terminé'
  };
  return map[statut] ?? statut;
}

export function libelleStatutMedecin(statut: string): string {
  const map: Record<string, string> = {
    pending: 'En attente',
    approved: 'Approuvé',
    rejected: 'Refusé'
  };
  return map[statut] ?? statut;
}

export function prenom(nom: string | null | undefined): string {
  return (nom || '').trim().split(/\s+/)[0] || '';
}

// '2026-10-26 09:00:00' -> '2026-10-26T09:00:00' (lisible par tous les navigateurs et par le pipe date)
export function isoLocal(valeur: string | null | undefined): string {
  return (valeur || '').replace(' ', 'T');
}

// Pour un champ <input type="datetime-local"> : 'YYYY-MM-DDTHH:mm'
export function pourChampDateHeure(valeur: string | null | undefined): string {
  return isoLocal(valeur).slice(0, 16);
}

export function libelleAction(action: string): string {
  const map: Record<string, string> = {
    medecin_cree: 'Médecin ajouté',
    medecin_modifie: 'Médecin modifié',
    medecin_approuve: 'Médecin approuvé',
    medecin_refuse: 'Médecin refusé',
    compte_active: 'Compte activé',
    compte_desactive: 'Compte désactivé',
    specialite_creee: 'Spécialité ajoutée',
    specialite_modifiee: 'Spécialité modifiée',
    specialite_activee: 'Spécialité activée',
    specialite_desactivee: 'Spécialité désactivée',
    rdv_modifie: 'Rendez-vous modifié'
  };
  return map[action] ?? action;
}
