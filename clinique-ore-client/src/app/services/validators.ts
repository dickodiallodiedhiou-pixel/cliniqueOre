// Format Sénégal : 9 chiffres, commence par 75, 76, 77 ou 78
export const TEL_REGEX = /^(75|76|77|78)\d{7}$/;
export const TEL_ERREUR = 'Numéro invalide : 9 chiffres, commençant par 77, 78, 76 ou 75 (ex : 771234567).';

// Garde uniquement les chiffres, 9 maximum
export function chiffres(valeur: string): string {
  return (valeur || '').replace(/\D/g, '').slice(0, 9);
}

export const PHOTO_MAX = 2 * 1024 * 1024; // 2 Mo
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
