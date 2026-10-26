import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Inscription d'un patient
  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  // Inscription d'un médecin (multipart : informations + justificatifs)
  registerMedecin(data: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/register/medecin`, data);
  }

  // Liste des spécialités (formulaire d'inscription médecin)
  getSpecialites(): Observable<{ id: number; nom: string }[]> {
    return this.http.get<{ id: number; nom: string }[]>(`${this.apiUrl}/specialites`);
  }

  // Connexion
  login(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, data);
  }

  // Déconnexion (révoque le token côté serveur ; le token est ajouté par l'intercepteur)
  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {});
  }

  // Profil de l'utilisateur connecté (statut de validation pour un médecin)
  me(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`);
  }

  // ----- Annuaire (public : médecins vérifiés uniquement) -----
  getMedecins(specialiteId?: number | null): Observable<any[]> {
    const query = specialiteId ? `?specialite_id=${specialiteId}` : '';
    return this.http.get<any[]>(`${this.apiUrl}/medecins${query}`);
  }

  // ----- Rendez-vous -----
  getRendezVous(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/rendez-vous`);
  }

  createRendezVous(data: { medecin_id: number; date_heure: string; motif?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/rendez-vous`, data);
  }

  annulerRendezVous(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/rendez-vous/${id}/annuler`, {});
  }

  updateStatutRendezVous(id: number, statut: 'confirme' | 'annule' | 'termine'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/rendez-vous/${id}/statut`, { statut });
  }

  // ----- Administration : validation des médecins -----
  adminGetMedecins(statut: 'pending' | 'approved' | 'rejected'): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/medecins?statut=${statut}`);
  }

  adminApprouver(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/medecins/${id}/approuver`, {});
  }

  adminRejeter(id: number, motif: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/medecins/${id}/rejeter`, { motif });
  }

  adminJustificatif(medecinId: number, justificatifId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/admin/medecins/${medecinId}/justificatifs/${justificatifId}`, {
      responseType: 'blob'
    });
  }

  // Tous les messages de validation (422) renvoyés par Laravel
  static validationMessages(err: HttpErrorResponse): string[] {
    const errors = err.error?.errors;
    if (!errors || typeof errors !== 'object') {
      return [];
    }
    return (Object.values(errors) as string[][]).flat();
  }

  // Transforme une erreur HTTP en message lisible (évite de planter sur err.error null)
  static errorMessage(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 0) {
      return "Impossible de joindre le serveur. Vérifiez que l'API Laravel tourne (php artisan serve) sur http://127.0.0.1:8000.";
    }
    const body = err.error;
    if (body && typeof body === 'object') {
      if (body.errors) {
        const first = Object.values(body.errors)[0] as string[] | undefined;
        if (first && first.length) { return first[0]; }
      }
      if (typeof body.message === 'string' && body.message) { return body.message; }
    }
    if (err.status === 403 && err.error?.message) {
      return err.error.message;
    }
    if (err.status === 413) {
      return 'Les fichiers envoyés sont trop volumineux (2 Mo maximum par document).';
    }
    if (err.status === 500) {
      return 'Erreur interne du serveur (voir storage/logs/laravel.log côté API).';
    }
    return fallback;
  }
}
