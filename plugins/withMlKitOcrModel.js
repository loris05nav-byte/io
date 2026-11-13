/**
 * Plugin de configuration Expo : demande à Google Play de télécharger le modèle de reconnaissance
 * de texte ML Kit dès l'installation de l'application, pour que le premier scan fonctionne
 * immédiatement (y compris hors connexion ensuite).
 *
 * Ajoute dans AndroidManifest.xml :
 *   <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="ocr,barcode_ui"
 *              tools:replace="android:value" />
 *
 * expo-camera déclare déjà cette clé avec « barcode_ui » : les deux valeurs sont donc fusionnées
 * (ML Kit accepte une liste séparée par des virgules) et la nôtre remplace celle de la bibliothèque.
 */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const META_NAME = 'com.google.mlkit.vision.DEPENDENCIES';

module.exports = function withMlKitOcrModel(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    manifest.manifest.$['xmlns:tools'] = manifest.manifest.$['xmlns:tools'] ?? 'http://schemas.android.com/tools';
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application['meta-data'] = (application['meta-data'] ?? []).filter((item) => item.$['android:name'] !== META_NAME);
    application['meta-data'].push({
      $: { 'android:name': META_NAME, 'android:value': 'ocr,barcode_ui', 'tools:replace': 'android:value' },
    });
    return mod;
  });
};
