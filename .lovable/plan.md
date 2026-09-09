# Isoler définitivement les données de chaque compte

## Correctif
- Supprimer la reprise automatique des données présentes dans le navigateur lors de l’ouverture d’un nouveau compte.
- Faire démarrer l’application intégrée avec une base vide jusqu’au chargement des données privées du compte connecté.
- Conserver uniquement les données déjà enregistrées dans le compte administrateur historique.
- Réinitialiser les copies déjà créées dans les comptes utilisateurs plus récents.

## Vérification
- Tester successivement un compte existant et un nouveau compte dans le même navigateur.
- Confirmer qu’aucune donnée n’apparaît avant ou après le chargement du nouveau compte.

## Détail technique
La cause est le stockage local partagé par tous les comptes sur un même appareil : il était encore repris automatiquement lorsqu’un compte ne possédait pas de données en ligne. Le correctif retire entièrement cette migration automatique et traite les données en ligne du compte connecté comme seule source.
