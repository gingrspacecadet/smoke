# smoke
A desktop game manager built with Electron.

## Usage
If all goes well, you can launch smoke using your favourite application launcher, or the command line. Upon opening, the list of all games on the database will be displayed, along with their name and a link to the download page. On the download page, you can download and install the game. If it is already downloaded, it will attempt to install. If it is already installed, it will redirect you to your library. This is where all your installed games appear. You can click on each card to view it, and play to run (note, on linux you may be required to have wine installed).

## Common failures
If a download gets cut off, then the downloaded rar will be incomplete. Upon restarting, it will go straight to installation, which will fail as the archive will unexpectedly stop. I am working on this. For the time being, you must manually delete $HOME/.smoke/downloads/GAME (or USER\.smoke\downloads\GAME on windows) and retry.

## Adding a new game
To add a new game to the registry, create an issue. It must contain a direct link to the archive (must be extractable using 7z), a link to a cover art image (roughly 1200x1200 for best quality) and the name of the game (must match the folder that gets extracted). 