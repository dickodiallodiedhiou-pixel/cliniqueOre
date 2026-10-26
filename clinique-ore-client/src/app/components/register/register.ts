import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';

type AccountType = 'patient' | 'medecin';
type JustificatifKey = 'diplome' | 'autorisation_exercice' | 'piece_identite';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent implements OnInit {
  accountType: AccountType = 'patient';

  userData = {
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    password: '',
    password_confirmation: ''
  };

  // Informations professionnelles (médecin)
  medecin = {
    specialite_id: null as number | null,
    numero_ordre: '',
    tarif_consultation: null as number | null,
    biographie: ''
  };

  specialites: { id: number; nom: string }[] = [];

  justificatifs: { key: JustificatifKey; label: string; file: File | null }[] = [
    { key: 'diplome', label: 'Diplôme de médecine', file: null },
    { key: 'autorisation_exercice', label: "Autorisation d'exercice", file: null },
    { key: 'piece_identite', label: "Pièce d'identité", file: null }
  ];

  errorMessage = '';
  successMessage = '';
  loading = false;

  constructor(private apiService: ApiService, private router: Router) {}

  ngOnInit() {
    this.apiService.getSpecialites().subscribe({
      next: (list) => (this.specialites = list),
      error: () => (this.specialites = [])
    });
  }

  setAccountType(type: AccountType) {
    this.accountType = type;
    this.errorMessage = '';
  }

  onFileChange(event: Event, key: JustificatifKey) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const item = this.justificatifs.find((j) => j.key === key)!;

    if (file && file.size > MAX_FILE_SIZE) {
      this.errorMessage = `${item.label} : le fichier dépasse 2 Mo.`;
      input.value = '';
      item.file = null;
      return;
    }
    this.errorMessage = '';
    item.file = file;
  }

  onRegister() {
    this.errorMessage = '';
    this.successMessage = '';

    // Vérifications côté client avant d'appeler l'API
    if (this.userData.password.length < 8) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 8 caractères.';
      this.montrerErreur();
      return;
    }
    if (this.userData.password !== this.userData.password_confirmation) {
      this.errorMessage = 'La confirmation du mot de passe ne correspond pas.';
      this.montrerErreur();
      return;
    }

    if (this.accountType === 'medecin') {
      this.registerMedecin();
    } else {
      this.registerPatient();
    }
  }

  private fullName(): string {
    return `${this.userData.prenom} ${this.userData.nom}`.trim();
  }

  private registerPatient() {
    const payload = {
      name: this.fullName(),
      email: this.userData.email,
      telephone: this.userData.telephone || null,
      password: this.userData.password,
      password_confirmation: this.userData.password_confirmation
    };

    this.loading = true;
    this.apiService.register(payload).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'Compte créé avec succès ! Redirection vers la connexion...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err: HttpErrorResponse) => this.onError(err)
    });
  }

  private registerMedecin() {
    if (!this.userData.telephone) {
      this.errorMessage = 'Le téléphone est obligatoire pour un médecin.';
      this.montrerErreur();
      return;
    }
    if (!this.medecin.specialite_id) {
      this.errorMessage = 'Veuillez choisir une spécialité.';
      this.montrerErreur();
      return;
    }
    const manquant = this.justificatifs.find((j) => !j.file);
    if (manquant) {
      this.errorMessage = `Document manquant : ${manquant.label}.`;
      this.montrerErreur();
      return;
    }

    const form = new FormData();
    form.append('name', this.fullName());
    form.append('email', this.userData.email);
    form.append('telephone', this.userData.telephone);
    form.append('password', this.userData.password);
    form.append('password_confirmation', this.userData.password_confirmation);
    form.append('specialite_id', String(this.medecin.specialite_id));
    form.append('numero_ordre', this.medecin.numero_ordre);
    form.append('tarif_consultation', String(this.medecin.tarif_consultation ?? ''));
    if (this.medecin.biographie) {
      form.append('biographie', this.medecin.biographie);
    }
    for (const j of this.justificatifs) {
      form.append(j.key, j.file as File);
    }

    this.loading = true;
    this.apiService.registerMedecin(form).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage =
          response.message || "Demande envoyée. Votre compte est en attente de validation par l'administrateur.";
        setTimeout(() => this.router.navigate(['/login']), 4000);
      },
      error: (err: HttpErrorResponse) => this.onError(err)
    });
  }

  private onError(err: HttpErrorResponse) {
    this.loading = false;
    const messages = ApiService.validationMessages(err);
    this.errorMessage = messages.length
      ? messages.join('\n')
      : ApiService.errorMessage(err, "Erreur lors de l'inscription.");
    this.montrerErreur();
  }

  // Le message est en haut du formulaire : on remonte pour qu'il soit visible
  private montrerErreur() {
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }
}
