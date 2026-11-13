/**
 * Plugin de configuration Expo : demande à Google Play de télécharger le modèle de reconnaissance
 * de texte ML Kit dès l'installation de l'application, pour que le premier scan fonctionne
 * immédiatement (y compris hors connexion ensuite).
 *
 * Ajoute dans AndroidManifest.xml :
 *   <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="ocr" />
 */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const META_NAME = 'com.google.mlkit.vision.DEPENDENCIES';

module.exports = function withMlKitOcrModel(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(application, META_NAME, 'ocr');
    return mod;
  });
};
