import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { LogoComponent } from '../logo/logo';
import { PHOTO_MAX, PHOTO_TYPES, TEL_ERREUR, TEL_REGEX, chiffres } from '../../services/validators';

type AccountType = 'patient' | 'medecin';
type JustificatifKey = 'diplome' | 'autorisation_exercice' | 'piece_identite';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LogoComponent],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // État affiché : en signaux pour que l'écran se rafraîchisse après chaque réponse de l'API
  accountType = signal<AccountType>('patient');
  specialites = signal<{ id: number; nom: string }[]>([]);
  errorMessage = signal('');
  successMessage = signal('');
  loading = signal(false);
  photoApercu = signal<string | null>(null);

  userData = {
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    adresse: '',
    sexe: '', // M, F ou vide (patient)
    password: '',
    password_confirmation: ''
  };

  // Informations professionnelles (médecin)
  medecin = {
    specialite_ids: [] as number[], // la première cochée est la spécialité principale
    numero_ordre: '',
    tarif_consultation: null as number | null,
    biographie: ''
  };

  photo: File | null = null;

  justificatifs: { key: JustificatifKey; label: string; file: File | null }[] = [
    { key: 'diplome', label: 'Diplôme de médecine', file: null },
    { key: 'autorisation_exercice', label: "Autorisation d'exercice", file: null },
    { key: 'piece_identite', label: "Pièce d'identité", file: null }
  ];

  ngOnInit() {
    // /register?type=medecin pré-sélectionne l'inscription médecin
    if (this.route.snapshot.queryParamMap.get('type') === 'medecin') {
      this.accountType.set('medecin');
    }
    this.apiService.getSpecialites().subscribe({
      next: (list) => this.specialites.set(list),
      error: () => this.specialites.set([])
    });
  }

  ngOnDestroy() {
    this.libererApercu();
  }

  setAccountType(type: AccountType) {
    this.accountType.set(type);
    this.errorMessage.set('');
  }

  // Téléphone : uniquement des chiffres, 9 maximum
  onTel(event: Event) {
    const input = event.target as HTMLInputElement;
    this.userData.telephone = chiffres(input.value);
    input.value = this.userData.telephone;
  }

  telephoneValide(): boolean {
    return TEL_REGEX.test(this.userData.telephone);
  }

  onPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (file && !PHOTO_TYPES.includes(file.type)) {
      input.value = '';
      this.photo = null;
      this.libererApercu();
      this.photoApercu.set(null);
      return this.echec('La photo doit être au format JPG, PNG ou WEBP.');
    }
    if (file && file.size > PHOTO_MAX) {
      input.value = '';
      this.photo = null;
      this.libererApercu();
      this.photoApercu.set(null);
      return this.echec('La photo dépasse 2 Mo.');
    }

    this.errorMessage.set('');
    this.photo = file;
    this.libererApercu();
    this.photoApercu.set(file ? URL.createObjectURL(file) : null);
  }

  onFileChange(event: Event, key: JustificatifKey) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const item = this.justificatifs.find((j) => j.key === key)!;

    if (file && file.size > MAX_FILE_SIZE) {
      input.value = '';
      item.file = null;
      return this.echec(`${item.label} : le fichier dépasse 2 Mo.`);
    }
    this.errorMessage.set('');
    item.file = file;
  }

  onRegister() {
    this.errorMessage.set('');
    this.successMessage.set('');

    // Vérifications côté client avant d'appeler l'API
    if (!this.photo) {
      return this.echec('Ajoutez votre photo de profil.');
    }
    if (!this.telephoneValide()) {
      return this.echec(TEL_ERREUR);
    }
    if (this.userData.password.length < 8) {
      return this.echec('Le mot de passe doit contenir au moins 8 caractères.');
    }
    if (this.userData.password !== this.userData.password_confirmation) {
      return this.echec('La confirmation du mot de passe ne correspond pas.');
    }

    if (this.accountType() === 'medecin') {
      this.registerMedecin();
    } else {
      this.registerPatient();
    }
  }

  estChoisie(id: number): boolean {
    return this.medecin.specialite_ids.includes(id);
  }

  basculerSpecialite(id: number) {
    this.medecin.specialite_ids = this.estChoisie(id)
      ? this.medecin.specialite_ids.filter((x) => x !== id)
      : [...this.medecin.specialite_ids, id];
  }

  // Champs communs patient / médecin
  private baseForm(): FormData {
    const form = new FormData();
    form.append('prenom', this.userData.prenom.trim());
    form.append('nom', this.userData.nom.trim());
    if (this.userData.adresse.trim()) {
      form.append('adresse', this.userData.adresse.trim());
    }
    if (this.accountType() === 'patient' && this.userData.sexe) {
      form.append('sexe', this.userData.sexe);
    }
    form.append('email', this.userData.email);
    form.append('telephone', this.userData.telephone);
    form.append('password', this.userData.password);
    form.append('password_confirmation', this.userData.password_confirmation);
    form.append('photo', this.photo as File);
    return form;
  }

  private registerPatient() {
    this.loading.set(true);
    this.apiService.register(this.baseForm()).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('Votre compte a été créé. Redirection vers la connexion...');
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err: HttpErrorResponse) => this.onError(err)
    });
  }

  private registerMedecin() {
    if (this.medecin.specialite_ids.length === 0) {
      return this.echec('Choisissez au moins une spécialité.');
    }
    const manquant = this.justificatifs.find((j) => !j.file);
    if (manquant) {
      return this.echec(`Document manquant : ${manquant.label}.`);
    }

    const form = this.baseForm();
    for (const id of this.medecin.specialite_ids) {
      form.append('specialite_ids[]', String(id));
    }
    form.append('numero_ordre', this.medecin.numero_ordre);
    form.append('tarif_consultation', String(this.medecin.tarif_consultation ?? ''));
    if (this.medecin.biographie) {
      form.append('biographie', this.medecin.biographie);
    }
    for (const j of this.justificatifs) {
      form.append(j.key, j.file as File);
    }

    this.loading.set(true);
    this.apiService.registerMedecin(form).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.successMessage.set(
          response.message || "Demande envoyée. Votre compte est en attente de validation."
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => this.router.navigate(['/login']), 4000);
      },
      error: (err: HttpErrorResponse) => this.onError(err)
    });
  }

  private onError(err: HttpErrorResponse) {
    this.loading.set(false);
    const messages = ApiService.validationMessages(err);
    this.echec(messages.length ? messages.join('\n') : ApiService.errorMessage(err, "Erreur lors de l'inscription."));
  }

  // Le message est en haut du formulaire : on remonte pour qu'il soit visible
  private echec(message: string) {
    this.errorMessage.set(message);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }

  private libererApercu() {
    const url = this.photoApercu();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
