# Folio Office

Suite bureautique mobile tout-en-un (React Native / Expo SDK 58, TypeScript) : traitement de texte, tableur, scanner OCR et convertisseur de fichiers. Design Material 3, thème clair/sombre/système, mode hors-ligne (tout est stocké sur l'appareil).

## Fonctionnalités

| Module | Contenu |
| --- | --- |
| **Accueil** | Tableau de bord : création rapide par catégorie, modèles (lettre, CV, compte rendu, budget, facture, notes), documents récents |
| **Traitement de texte** | Gras/italique/souligné/barré, titres, tailles et polices, couleurs et surlignage, alignements, listes, retraits, interligne, citations, tableaux, images, liens, annuler/rétablir, enregistrement automatique |
| **Tableur** | Grille dynamique, saisie dans la barre de formule, formules `SOMME`, `MOYENNE`, `MIN`, `MAX`, `NB`, `SI`, `ARRONDI`… (FR/EN), références et plages (`A1:B3`), insertion de cellule par appui pendant une formule, mise en forme, formats nombre/monétaire/%, insertion/suppression de lignes et colonnes (formules réajustées), largeur de colonne, statistiques de sélection |
| **Scanner OCR** | Caméra ou galerie → texte modifiable → nouveau document ou insertion dans un document ouvert. Moteur natif Google ML Kit (hors-ligne) ; repli Tesseract.js (WebView) quand le module natif est absent |
| **Convertisseur** | Documents ou fichiers importés (TXT, MD, HTML, CSV) → PDF, HTML, TXT, Markdown, CSV ; partage, enregistrement dans un dossier (Android), impression |

## Structure

```
App.tsx                      Racine : providers + navigation
src/
  theme/                     Jetons Material 3, palettes claire/sombre
  navigation/                Pile + onglets, barre inférieure
  store/                     Contextes : documents, réglages
  screens/                   Accueil, Fichiers, Convertir, éditeurs, scanner, réglages
  components/                UI (ui/), ruban d'outils, grille du tableur, export…
  editor/                    Page HTML de l'éditeur riche (WebView)
  services/
    spreadsheet/             Moteur de formules et modèle de feuille
    converter/               HTML ⇄ TXT/Markdown, CSV, export, partage
    ocr/                     ML Kit natif + Tesseract de secours
    storage/                 Index (AsyncStorage) + contenu (fichiers)
    __tests__/               Tests unitaires (Jest)
plugins/withMlKitOcrModel.js Plugin Expo : pré-télécharge le modèle OCR
```

## Développement

```bash
npm install
npm start            # Expo Go (OCR via Tesseract, connexion requise au 1er scan)
npm run android      # build de développement local (OCR natif ML Kit)
npm test             # tests unitaires
npm run typecheck
```

> Le module OCR natif (`expo-text-extractor`) n'est pas inclus dans Expo Go : utilisez un build de développement ou l'APK pour l'OCR hors-ligne.

## Générer l'APK

**Dans le cloud (EAS)** — aucun SDK Android requis :

```bash
npm install -g eas-cli
eas login
npm run build:apk        # profil « preview » → fichier .apk installable
```

**En local** (JDK 17+ et Android SDK requis) :

```bash
npm run build:apk:local  # APK dans android/app/build/outputs/apk/release/
```

`npm run build:aab` produit un Android App Bundle pour le Play Store (profil `production`). Les profils sont définis dans `eas.json`.
