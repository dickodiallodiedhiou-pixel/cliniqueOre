import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Inscription d'un patient (multipart : informations + photo)
  register(data: FormData): Observable<any> {
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

  // Créneaux libres d'un médecin (14 prochains jours) : { '2026-10-26': ['09:00', '09:30'], ... }
  getCreneaux(medecinId: number): Observable<Record<string, string[]>> {
    return this.http.get<Record<string, string[]>>(`${this.apiUrl}/medecins/${medecinId}/creneaux`);
  }

  // ----- Profil -----
  updateProfil(data: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/me`, data);
  }

  // ----- Disponibilités du médecin -----
  getDisponibilites(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/medecin/disponibilites`);
  }

  saveDisponibilites(plages: any[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/medecin/disponibilites`, { plages });
  }

  // ----- Rendez-vous -----
  getRendezVous(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/rendez-vous`);
  }

  createRendezVous(data: { medecin_id: number; date_heure: string; motif?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/rendez-vous`, data);
  }

  modifierRendezVous(id: number, data: { date_heure: string; motif?: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/rendez-vous/${id}`, data);
  }

  annulerRendezVous(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/rendez-vous/${id}/annuler`, {});
  }

  // Changement de statut par le médecin ; le compte rendu est facultatif (utile à la clôture)
  updateStatutRendezVous(id: number, statut: 'confirme' | 'refuse' | 'annule' | 'termine', notes?: string): Observable<any> {
    const corps: Record<string, string> = { statut };
    if (notes) corps['notes_medecin'] = notes;
    return this.http.patch(`${this.apiUrl}/rendez-vous/${id}/statut`, corps);
  }

  // ----- Historique des consultations -----
  getHistoriquePatient(page = 1): Observable<any> {
    return this.http.get(`${this.apiUrl}/historique`, { params: this.params({ page }) });
  }

  getHistoriqueMedecin(filtres: Record<string, any> = {}): Observable<any> {
    return this.http.get(`${this.apiUrl}/medecin/historique`, { params: this.params(filtres) });
  }

  modifierNotes(id: number, notes: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/rendez-vous/${id}/notes`, { notes_medecin: notes });
  }

  // ----- Espace médecin -----
  medecinStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/medecin/tableau-de-bord`);
  }

  // Réponse paginée + { compteurs: { en_attente: n, confirme: n, ... } }
  medecinRendezVous(filtres: Record<string, any> = {}): Observable<any> {
    return this.http.get(`${this.apiUrl}/medecin/rendez-vous`, { params: this.params(filtres) });
  }

  medecinPatient(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/medecin/patients/${id}`);
  }

  medecinPlanning(debut?: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/medecin/planning`, { params: this.params({ debut }) });
  }

  getIndisponibilites(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/medecin/indisponibilites`);
  }

  creerIndisponibilite(data: Record<string, any>): Observable<any> {
    return this.http.post(`${this.apiUrl}/medecin/indisponibilites`, data);
  }

  supprimerIndisponibilite(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/medecin/indisponibilites/${id}`);
  }

  // ----- Médecins (profil détaillé et prochain créneau) -----
  getMedecinsAvecCreneaux(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/medecins`, { params: this.params({ avec_creneaux: 1 }) });
  }

  getMedecin(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/medecins/${id}`);
  }

  // ----- Espace patient -----
  patientStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/patient/tableau-de-bord`);
  }

  // onglet : avenir | passes | annules — réponse paginée + { compteurs }
  patientRendezVous(filtres: Record<string, any> = {}): Observable<any> {
    return this.http.get(`${this.apiUrl}/patient/rendez-vous`, { params: this.params(filtres) });
  }

  // ----- Notifications -----
  notifications(page = 1): Observable<any> {
    return this.http.get(`${this.apiUrl}/notifications`, { params: this.params({ page }) });
  }

  notificationsNonLues(): Observable<{ non_lues: number }> {
    return this.http.get<{ non_lues: number }>(`${this.apiUrl}/notifications/non-lues`);
  }

  lireNotification(id: string): Observable<{ non_lues: number }> {
    return this.http.post<{ non_lues: number }>(`${this.apiUrl}/notifications/${id}/lire`, {});
  }

  toutLireNotifications(): Observable<{ non_lues: number }> {
    return this.http.post<{ non_lues: number }>(`${this.apiUrl}/notifications/tout-lire`, {});
  }

  // ----- Mot de passe -----
  motDePasseOublie(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/mot-de-passe/oublie`, { email });
  }

  reinitialiserMotDePasse(data: Record<string, any>): Observable<any> {
    return this.http.post(`${this.apiUrl}/mot-de-passe/reinitialiser`, data);
  }

  changerMotDePasse(data: Record<string, any>): Observable<any> {
    return this.http.post(`${this.apiUrl}/me/mot-de-passe`, data);
  }

  // ----- Administration -----
  // Construit des paramètres d'URL en ignorant les valeurs vides
  private params(obj: Record<string, any>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined && v !== '') {
        p = p.set(k, String(v));
      }
    }
    return p;
  }

  adminStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/tableau-de-bord`);
  }

  // Médecins (réponse paginée : { data, current_page, last_page, total })
  adminMedecins(filtres: Record<string, any> = {}): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/medecins`, { params: this.params(filtres) });
  }

  adminCreerMedecin(data: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/medecins`, data);
  }

  adminModifierMedecin(id: number, data: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/medecins/${id}/modifier`, data);
  }

  adminActifMedecin(id: number, actif: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/medecins/${id}/actif`, { actif });
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

  // Patients
  adminPatients(filtres: Record<string, any> = {}): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/patients`, { params: this.params(filtres) });
  }

  adminPatient(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/patients/${id}`);
  }

  adminActifPatient(id: number, actif: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/patients/${id}/actif`, { actif });
  }

  // Spécialités
  adminSpecialites(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/specialites`);
  }

  adminCreerSpecialite(data: { nom: string; description?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/specialites`, data);
  }

  adminModifierSpecialite(id: number, data: { nom: string; description?: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/specialites/${id}`, data);
  }

  adminActifSpecialite(id: number, actif: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/specialites/${id}/actif`, { actif });
  }

  // Supervision des rendez-vous
  adminRendezVous(filtres: Record<string, any> = {}): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/rendez-vous`, { params: this.params(filtres) });
  }

  adminConflits(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/rendez-vous/conflits`);
  }

  adminModifierRdv(id: number, data: { statut?: string; date_heure?: string; medecin_id?: number }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/admin/rendez-vous/${id}`, data);
  }

  // Journal d'activité
  adminJournal(page = 1): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/journal`, { params: this.params({ page }) });
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
