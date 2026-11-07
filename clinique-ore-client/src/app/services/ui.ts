// Petits utilitaires d'affichage
export function libelleRdv(statut: string): string {
  const map: Record<string, string> = {
    en_attente: 'En attente',
    confirme: 'Confirmé',
    refuse: 'Refusé',
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

// Dates 'YYYY-MM-DD' en heure locale (sans décalage de fuseau)
export function formatDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

export function ajouterJours(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

// Lundi de la semaine contenant la date donnée
export function lundiDe(date: Date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return formatDate(d);
}

export const JOURS_SEMAINE = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export function nomJour(n: number): string {
  return JOURS_SEMAINE[n] ?? '';
}

// Noms des spécialités d'un médecin (la première est la spécialité principale)
export function nomsSpecialites(m: any): string[] {
  return (m?.specialites ?? []).map((s: any) => s.nom);
}

// « Awa Diop » -> ['Awa', 'Diop'] ; un seul mot -> ['', mot]
export function separerNomComplet(nomComplet: string): [string, string] {
  const parts = (nomComplet || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ['', ''];
  if (parts.length === 1) return ['', parts[0]];
  return [parts[0], parts.slice(1).join(' ')];
}
