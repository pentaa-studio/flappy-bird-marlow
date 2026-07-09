// Flappy Bird — full web game (HTML5 Canvas + JavaScript)

// --- Setup ---
const WIDTH = 288;
const HEIGHT = 512;
const ESPACE_TUYAUX = 100;
const ECART_ENTRE_TUYAUX = 145;
// FlappySwift (GameScene.swift): gravity dy=-5, flap impulse dy=30, pipes 100 pt/s
// Scaled from ~568pt iPhone scene to our 512px canvas
const ECHELLE_SCENE = HEIGHT / 568;
const GRAVITE = 480 * ECHELLE_SCENE;
const FLAP_FORCE = -215 * ECHELLE_SCENE;
const VITESSE_MAX_CHUTE = 350 * ECHELLE_SCENE;
const VITESSE_TUYAUX_NORMALE = 100 * ECHELLE_SCENE;
const VITESSE_RAPIDE = VITESSE_TUYAUX_NORMALE * 2;
const VITESSE_LENTE = VITESSE_TUYAUX_NORMALE * 0.5;
const VITESSE_ULTRA_RAPIDE = VITESSE_TUYAUX_NORMALE * 4;
const VITESSE_ULTRA_LENTE = VITESSE_TUYAUX_NORMALE * 0.25;
const DT_MAX = 0.05;

const canvas = document.getElementById("jeu");
const ctx = canvas.getContext("2d");
const pseudoInput = document.getElementById("pseudo-input");
const TOUCH_DEVICE = "ontouchstart" in window;

const PODIUM_KEY = "flappy_podium";
const PSEUDO_KEY = "flappy_pseudo";
const PSEUDO_MAX = 12;
const PODIUM_MAX = 5;
const SKIN_KEY = "flappy_skin";
const UNLOCK_KEY = "flappy_unlock_max";
const VERSION_KEY = "flappy_version";
const GEMMES_KEY = "flappy_gemmes";
const NIVEAU_KEY = "flappy_niveau";
const COUT_NOURRIR = 3;
const NIVEAU_MAX = 5;

// One-time podium reset (runs once per browser thanks to the version flag)
if (localStorage.getItem(VERSION_KEY) !== "2") {
    localStorage.removeItem(PODIUM_KEY);
    localStorage.setItem(VERSION_KEY, "2");
}

// Skins: 3 base (original v1.2) + unlock every 10 pts (medals + 2025 characters)
// Each skin has its own pixel-art SVG sprite in images/svg/
const SKINS = [
    { id: "rouge", nom: "Rouge", sprite: "flappyrouge", scoreDeblocage: 0 },
    { id: "bleu", nom: "Bleu", sprite: "flappybleu", scoreDeblocage: 0 },
    { id: "jaune", nom: "Jaune", sprite: "flappyjaune", scoreDeblocage: 0 },
    { id: "bronze", nom: "Bronze", sprite: "flappybronze", scoreDeblocage: 10 },
    { id: "argent", nom: "Argent", sprite: "flappyargent", scoreDeblocage: 20 },
    { id: "or", nom: "Or", sprite: "flappyor", scoreDeblocage: 30 },
    { id: "platine", nom: "Platine", sprite: "flappyplatine", scoreDeblocage: 40 },
    { id: "vert", nom: "Vert", sprite: "flappyvert", scoreDeblocage: 50 },
    { id: "rose", nom: "Rose", sprite: "flappyrose", scoreDeblocage: 60 },
    { id: "tekno", nom: "Tekno", sprite: "flappytekno", scoreDeblocage: 70 },
    { id: "quirky", nom: "Quirky", sprite: "flappyquirky", scoreDeblocage: 80 },
    { id: "cyber", nom: "Cyber", sprite: "flappycyber", scoreDeblocage: 90 },
    { id: "flamme", nom: "Flamme", sprite: "flappyflamme", scoreDeblocage: 100 },
    { id: "cosmos", nom: "Cosmos", sprite: "flappycosmos", scoreDeblocage: 110 },
    { id: "legende", nom: "Legende", sprite: "flappylegende", scoreDeblocage: 120 },
];

const SKIN_POPUP_DUREE = 2500;

const FONT_PIXEL = '"Press Start 2P", monospace';
const FONT_EMOJI = "Apple Color Emoji, Segoe UI Emoji, sans-serif";
const EMOJI_COL_WIDTH = 28;
const GAP_EMOJI_TEXTE = 6;

// --- Responsive fullscreen (sharp text on Retina) ---
function redimensionner() {
    const ratio = WIDTH / HEIGHT;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    let cssW;
    let cssH;
    if (vw / vh < ratio) {
        cssW = vw;
        cssH = vw / ratio;
    } else {
        cssH = vh;
        cssW = vh * ratio;
    }

    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
}

window.addEventListener("resize", redimensionner);
redimensionner();

// --- Images ---
const images = {};
// One SVG sprite per skin, plus the PNG decor images
const nomsImages = [
    "fond-jour", "fond-nuit", "gameover",
    "tuyau-vert-haut", "tuyau-vert-bas",
    "flappyflamme-effet-1", "flappyflamme-effet-2", "flappyor-couronne",
    ...SKINS.map((s) => s.sprite + "-milieu"),
];

function cheminImage(nom) {
    // Bird sprites are SVG, decor stays PNG
    if (nom.startsWith("flappy")) return "images/svg/" + nom + ".svg";
    return "images/" + nom + ".png";
}

// --- Game state ---
let phase = "accueil";
let pseudo = localStorage.getItem(PSEUDO_KEY) || "";
let skinIndex = Math.max(0, SKINS.findIndex((s) => s.id === localStorage.getItem(SKIN_KEY)));
if (skinIndex < 0) skinIndex = 0;
let scoreEnregistre = false;
let oiseauY = HEIGHT / 4;
let oiseauVY = 0;
let score = 0;
let vies = 3;
let nouveauBestScore = false;
let skinDebloquePopup = null;
let skinDebloqueFin = 0;
let scoreMaxPartie = 0;
let gemmesGagneesPartie = 0;
let messageNourrirVisible = false;
let nourrirFeedbackFin = 0;
let nourrirErreurFin = 0;
let nourrirErreurMsg = "";

let tuyaux = [];

// --- Secret modes (A / Z / E / R) ---
let mode = "normal";
let dernierTemps = null;

function activerMode(nomMode) {
    mode = mode === nomMode ? "normal" : nomMode;
}

function vitesseActuelle() {
    if (mode === "rapide") return VITESSE_RAPIDE;
    if (mode === "lent") return VITESSE_LENTE;
    if (mode === "ultra_rapide") return VITESSE_ULTRA_RAPIDE;
    if (mode === "ultra_lent") return VITESSE_ULTRA_LENTE;
    return VITESSE_TUYAUX_NORMALE;
}

function pointsParTuyau() {
    if (mode === "rapide") return 2;
    if (mode === "lent") return 0.5;
    if (mode === "ultra_rapide") return 4;
    if (mode === "ultra_lent") return 0.25;
    return 1;
}

function formaterScore(valeur) {
    if (Number.isInteger(valeur)) return String(valeur);
    return parseFloat(valeur.toFixed(2)).toString();
}

// --- Podium ---
function lirePodium() {
    try {
        return JSON.parse(localStorage.getItem(PODIUM_KEY) || "[]");
    } catch {
        return [];
    }
}

function pseudoActuel() {
    return pseudo.trim().slice(0, PSEUDO_MAX);
}

function skinActif() {
    return SKINS[skinIndex];
}

function lireMaxDeblocage() {
    const nom = pseudoActuel();
    if (!nom) return 0;
    return parseFloat(localStorage.getItem(UNLOCK_KEY + "_" + nom) || "0") || 0;
}

function sauverMaxDeblocage(valeur) {
    const nom = pseudoActuel();
    if (!nom) return;
    const ancien = lireMaxDeblocage();
    if (valeur > ancien) {
        localStorage.setItem(UNLOCK_KEY + "_" + nom, String(valeur));
    }
}

function recordPourDeblocage() {
    return Math.max(lireMaxDeblocage(), scoreMaxPartie, score);
}

// --- Gems and bird level ---
function lireGemmes() {
    const nom = pseudoActuel();
    if (!nom) return 0;
    return parseInt(localStorage.getItem(GEMMES_KEY + "_" + nom) || "0", 10) || 0;
}

function ajouterGemmes(combien) {
    const nom = pseudoActuel();
    if (!nom) return;
    localStorage.setItem(GEMMES_KEY + "_" + nom, String(lireGemmes() + combien));
    if (combien > 0) gemmesGagneesPartie += combien;
}

function lireNiveau() {
    const nom = pseudoActuel();
    if (!nom) return 0;
    return parseInt(localStorage.getItem(NIVEAU_KEY + "_" + nom) || "0", 10) || 0;
}

function nourrirOiseau() {
    const niveau = lireNiveau();
    if (niveau >= NIVEAU_MAX) {
        nourrirErreurMsg = "Niveau max !";
        nourrirErreurFin = Date.now() + 2000;
        return false;
    }
    if (lireGemmes() < COUT_NOURRIR) {
        nourrirErreurMsg = "Il faut " + COUT_NOURRIR + " gemmes";
        nourrirErreurFin = Date.now() + 2000;
        return false;
    }
    localStorage.setItem(NIVEAU_KEY + "_" + pseudoActuel(), String(niveau + 1));
    localStorage.setItem(GEMMES_KEY + "_" + pseudoActuel(), String(lireGemmes() - COUT_NOURRIR));
    nourrirFeedbackFin = Date.now() + 2000;
    messageNourrirVisible = false;
    return true;
}

function toucheEstF(e) {
    return e.code === "KeyF" || e.key === "f" || e.key === "F";
}

function gererToucheNourrir() {
    if (!messageNourrirVisible) {
        messageNourrirVisible = true;
        return;
    }
    nourrirOiseau();
}

function graviteEffective() {
    return GRAVITE * (1 - lireNiveau() * 0.03);
}

function forceFlap() {
    return FLAP_FORCE * (1 + lireNiveau() * 0.05);
}

function flap() {
    // Same pattern as FlappySwift: reset vertical speed, then flap impulse
    oiseauVY = 0;
    oiseauVY = forceFlap();
}

function inclinaisonOiseau() {
    // FlappySwift update(): rotation from vertical velocity
    const facteur = oiseauVY > 0 ? 0.003 : 0.001;
    return Math.max(-1, Math.min(0.5, oiseauVY * facteur));
}

function viesDepart() {
    return 3 + lireNiveau();
}

function zoneNourrirSkins() {
    return { x: 8, y: 8, w: WIDTH - 16, h: 46 };
}

function skinEstDebloque(skin) {
    return recordPourDeblocage() >= skin.scoreDeblocage;
}

function skinsDebloques() {
    return SKINS.filter(skinEstDebloque);
}

function prochainSkinDebloque() {
    return SKINS.find((s) => s.scoreDeblocage > 0 && !skinEstDebloque(s)) ?? null;
}

function assurerSkinDebloque() {
    if (skinEstDebloque(SKINS[skinIndex])) return;
    const debloques = skinsDebloques();
    if (debloques.length === 0) return;
    skinIndex = SKINS.findIndex((s) => s.id === debloques[0].id);
}

function imageOiseau() {
    return images[skinActif().sprite + "-milieu"];
}

function dimensionsOiseau() {
    const img = imageOiseau();
    return { w: img.width, h: img.height };
}

function dessinerOiseauCentre(centreY, scale = 1, rotation = 0) {
    const img = imageOiseau();
    const w = img.width * scale;
    const h = img.height * scale;
    const centreX = WIDTH / 2;

    // Flame skin: flickering flame trail behind the bird
    if (skinActif().id === "flamme") {
        const frame = Math.floor(Date.now() / 120) % 2 === 0 ? 1 : 2;
        const flamme = images["flappyflamme-effet-" + frame];
        const fw = flamme.width * scale;
        const fh = flamme.height * scale;
        ctx.drawImage(flamme, centreX - w / 2 - fw + 4 * scale, centreY - fh / 2, fw, fh);
    }

    ctx.save();
    ctx.translate(centreX, centreY);
    ctx.rotate(rotation);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    // Gold skin: pixel crown on the head
    if (skinActif().id === "or") {
        const couronne = images["flappyor-couronne"];
        const cw = couronne.width * scale;
        const ch = couronne.height * scale;
        ctx.drawImage(couronne, -4 * scale - cw / 2, -h / 2 - ch + 2 * scale, cw, ch);
    }

    ctx.restore();
}

function verifierNouveauxSkins(ancienMax, nouveauMax) {
    let nouveau = null;
    for (const skin of SKINS) {
        // Only skins never unlocked before (above the old all-time record)
        if (skin.scoreDeblocage > ancienMax && skin.scoreDeblocage <= nouveauMax) {
            if (!nouveau || skin.scoreDeblocage > nouveau.scoreDeblocage) {
                nouveau = skin;
            }
        }
    }
    if (nouveau) {
        skinDebloquePopup = nouveau;
        skinDebloqueFin = Date.now() + SKIN_POPUP_DUREE;
        ajouterGemmes(1);
    }
}

function ajouterScore(points) {
    const ancienMax = Math.max(lireMaxDeblocage(), scoreMaxPartie);
    score += points;
    scoreMaxPartie = Math.max(scoreMaxPartie, score);
    sauverMaxDeblocage(scoreMaxPartie);
    verifierNouveauxSkins(ancienMax, scoreMaxPartie);
}

function changerSkin(direction) {
    const debloques = skinsDebloques();
    if (debloques.length === 0) return;

    const ids = debloques.map((s) => s.id);
    let idx = ids.indexOf(SKINS[skinIndex].id);
    if (idx < 0) idx = 0;
    idx = (idx + direction + debloques.length) % debloques.length;
    skinIndex = SKINS.findIndex((s) => s.id === debloques[idx].id);
}

function meilleurScoreJoueur() {
    const nom = pseudoActuel();
    if (!nom) return 0;
    const joueur = lirePodium().find((entry) => entry.nom === nom);
    return joueur ? joueur.score : 0;
}

function meilleurScorePodium() {
    const podium = lirePodium();
    if (podium.length === 0) return 0;
    podium.sort((a, b) => b.score - a.score);
    return podium[0].score;
}

function enregistrerAuPodium() {
    const nom = pseudoActuel();
    // Save the best score of the whole game (lives reset score to 0)
    const meilleur = scoreMaxPartie;
    if (!nom || meilleur <= 0) return;

    let podium = lirePodium();
    const index = podium.findIndex((entry) => entry.nom === nom);

    if (index >= 0) {
        if (meilleur > podium[index].score) {
            podium[index].score = meilleur;
        }
    } else {
        podium.push({ nom: nom, score: meilleur });
    }

    podium.sort((a, b) => b.score - a.score);
    podium = podium.slice(0, PODIUM_MAX);
    localStorage.setItem(PODIUM_KEY, JSON.stringify(podium));
    localStorage.setItem(PSEUDO_KEY, nom);
}

function finDePartie() {
    if (scoreEnregistre) return;
    scoreEnregistre = true;
    scoreMaxPartie = Math.max(scoreMaxPartie, score);
    sauverMaxDeblocage(scoreMaxPartie);
    nouveauBestScore = scoreMaxPartie > meilleurScorePodium();
    if (scoreMaxPartie > meilleurScoreJoueur()) {
        ajouterGemmes(1);
    }
    phase = "mort";
    enregistrerAuPodium();
}

function libelleMode() {
    if (mode === "rapide") return { texte: "MODE RAPIDE 2 pts", couleur: "#FFD700" };
    if (mode === "lent") return { texte: "MODE LENT 0.5 pt", couleur: "#87CEEB" };
    if (mode === "ultra_rapide") return { texte: "ULTRA RAPIDE 4 pts", couleur: "#FF4500" };
    if (mode === "ultra_lent") return { texte: "ULTRA LENT 0.25 pt", couleur: "#9370DB" };
    return null;
}

function chargerImage(nom) {
    return new Promise((ok, ko) => {
        const img = new Image();
        img.onload = () => { images[nom] = img; ok(); };
        img.onerror = ko;
        img.src = cheminImage(nom);
    });
}

// Wait for images and the pixel font before starting the loop
const chargerFont = document.fonts
    ? document.fonts.load('10px "Press Start 2P"').catch(() => {})
    : Promise.resolve();

Promise.all([...nomsImages.map(chargerImage), chargerFont]).then(boucle).catch(() => {
    ctx.fillStyle = "#c00";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.fillText("Images introuvables", 60, HEIGHT / 2);
});

// --- Logic ---
function largeurTuyau() {
    return images["tuyau-vert-bas"].width;
}

function gapTuyauAleatoire() {
    return 100 + Math.floor(Math.random() * (HEIGHT - ESPACE_TUYAUX - 200));
}

function creerTuyau(x) {
    return { x, gapTop: gapTuyauAleatoire(), score: false };
}

function assurerTuyaux() {
    const tW = largeurTuyau();
    let bordDroit = tuyaux.length ? Math.max(...tuyaux.map((t) => t.x + tW)) : 0;

    while (bordDroit < WIDTH + tW) {
        const x = tuyaux.length
            ? tuyaux[tuyaux.length - 1].x + tW + ECART_ENTRE_TUYAUX
            : WIDTH;
        tuyaux.push(creerTuyau(x));
        bordDroit = x + tW;
    }
}

function reinitialiserTuyaux() {
    tuyaux = [creerTuyau(WIDTH)];
    assurerTuyaux();
}

function resetPartie() {
    oiseauY = HEIGHT / 4;
    oiseauVY = 0;
    score = 0;
    vies = viesDepart();
    scoreMaxPartie = 0;
    gemmesGagneesPartie = 0;
    nouveauBestScore = false;
    skinDebloquePopup = null;
    skinDebloqueFin = 0;
    reinitialiserTuyaux();
}

function perdreVie() {
    vies--;
    if (vies <= 0) {
        finDePartie();
        return;
    }
    score = 0;
    nouveauBestScore = false;
    oiseauY = HEIGHT / 4;
    oiseauVY = 0;
    reinitialiserTuyaux();
}

function rectsCollident(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Pixel text with a dark outline, like the original Flappy Bird
function dessinerTexte(texte, x, y, size, color, centre, contour) {
    ctx.font = size + "px " + FONT_PIXEL;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = centre ? "center" : "left";
    const px = Math.round(x);
    const py = Math.round(y);

    if (contour !== false) {
        ctx.strokeStyle = "#543847";
        ctx.lineWidth = Math.max(2, Math.floor(size / 4));
        ctx.lineJoin = "round";
        ctx.strokeText(texte, px, py);
    }

    ctx.fillStyle = color;
    ctx.fillText(texte, px, py);
    ctx.textAlign = "left";
}

function dessinerEmojiEtTexteCentre(emoji, texte, centreX, y, sizeTexte, couleur, gras, gap) {
    const ecart = gap ?? 3;
    const py = Math.round(y);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = sizeTexte + "px " + FONT_EMOJI;
    const wEmoji = ctx.measureText(emoji).width;
    ctx.font = sizeTexte + "px " + FONT_PIXEL;
    const wTexte = ctx.measureText(texte).width;
    const x = Math.round(centreX - (wEmoji + ecart + wTexte) / 2);
    ctx.font = sizeTexte + "px " + FONT_EMOJI;
    ctx.fillStyle = couleur;
    ctx.fillText(emoji, x, py);
    ctx.font = sizeTexte + "px " + FONT_PIXEL;
    ctx.fillText(texte, Math.round(x + wEmoji + ecart), py);
}

function dessinerEmojiEtTexteGauche(emoji, texte, x, y, sizeTexte, couleur) {
    const gap = 3;
    const py = Math.round(y);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = sizeTexte + "px " + FONT_EMOJI;
    ctx.fillStyle = couleur;
    ctx.fillText(emoji, x, py);
    const wEmoji = ctx.measureText(emoji).width;
    ctx.font = sizeTexte + "px " + FONT_PIXEL;
    ctx.fillText(texte, Math.round(x + wEmoji + gap), py);
}

function dessinerBarreNourrir(actif) {
    const z = zoneNourrirSkins();
    const niveau = lireNiveau();
    const centreY = z.y + z.h / 2;

    ctx.fillStyle = "#543847";
    ctx.fillRect(z.x - 2, z.y - 2, z.w + 4, z.h + 4);
    ctx.fillStyle = actif ? "#fc7e38" : "#fff5cc";
    ctx.fillRect(z.x, z.y, z.w, z.h);

    const sizeGem = actif ? 10 : 9;
    const sizeTitre = actif ? 9 : 8;
    const libelle = actif ? "NOURRIR!" : "Nourrir";
    const couleurTitre = actif ? "#fff" : "#543847";

    dessinerEmojiEtTexteGauche("💎", String(lireGemmes()), z.x + 8, centreY, sizeGem, actif ? "#fff" : "#543847");
    dessinerEmojiEtTexteCentre("🌾", libelle, WIDTH / 2, centreY, sizeTitre, couleurTitre, actif, 4);

    if (niveau > 0) {
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.font = (actif ? 9 : 8) + "px " + FONT_PIXEL;
        ctx.fillStyle = actif ? "#fff" : "#4ba828";
        ctx.fillText("Nv." + niveau, z.x + z.w - 42, centreY);
    }
}

function largeurEmoji(emoji, size) {
    ctx.font = size + "px " + FONT_EMOJI;
    return ctx.measureText(emoji).width;
}

function dessinerEmojiDansColonne(emoji, xCol, y, size, couleur) {
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = size + "px " + FONT_EMOJI;
    ctx.fillStyle = couleur ?? "#fff";
    const wEmoji = ctx.measureText(emoji).width;
    const x = Math.round(xCol + (EMOJI_COL_WIDTH - wEmoji) / 2);
    ctx.fillText(emoji, x, Math.round(y));
}

function dessinerEmojiEtTexte(emoji, texte, centreX, y, sizeTexte, couleur, ecart) {
    const gap = ecart ?? GAP_EMOJI_TEXTE;
    const sizeEmoji = sizeTexte;
    const py = Math.round(y);

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    ctx.font = sizeEmoji + "px " + FONT_EMOJI;
    const wEmoji = largeurEmoji(emoji, sizeEmoji);
    ctx.font = sizeTexte + "px " + FONT_PIXEL;
    const wTexte = ctx.measureText(texte).width;
    const colW = Math.min(EMOJI_COL_WIDTH, wEmoji + 2);
    const x = Math.round(centreX - (colW + gap + wTexte) / 2);

    ctx.font = sizeEmoji + "px " + FONT_EMOJI;
    ctx.fillStyle = couleur;
    ctx.fillText(emoji, x, py);
    ctx.font = sizeTexte + "px " + FONT_PIXEL;
    ctx.fillText(texte, Math.round(x + wEmoji + gap), py);
}

function dessinerEmojiNomScore(emoji, nom, points, x, y, wRow) {
    const py = Math.round(y);
    const xCol = Math.round(x);

    dessinerEmojiDansColonne(emoji, xCol, py, 12, "#543847");

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "9px " + FONT_PIXEL;
    ctx.fillStyle = "#543847";
    ctx.fillText(nom, Math.round(xCol + EMOJI_COL_WIDTH + GAP_EMOJI_TEXTE), py);

    ctx.textAlign = "right";
    ctx.fillStyle = "#e86101";
    ctx.fillText(points, Math.round(x + wRow), py);
    ctx.textAlign = "left";
}

// Beige panel with brown border, like the original score board
function dessinerPanneauPixel(fond) {
    const imageFond = fond === "nuit" ? images["fond-nuit"] : images["fond-jour"];
    ctx.drawImage(imageFond, 0, 0, WIDTH, HEIGHT);

    const m = 8;
    ctx.fillStyle = "#543847";
    ctx.fillRect(m, m, WIDTH - m * 2, HEIGHT - m * 2);
    ctx.fillStyle = "#fff5cc";
    ctx.fillRect(m + 3, m + 3, WIDTH - (m + 3) * 2, HEIGHT - (m + 3) * 2);
    ctx.fillStyle = "#ded895";
    ctx.fillRect(m + 6, m + 6, WIDTH - (m + 6) * 2, HEIGHT - (m + 6) * 2);
}

function yChampPseudoAccueil() {
    const gap = 16;
    const hChamp = 34;
    const hPodium = 15 + 10 + hauteurBlocPodium(PODIUM_MAX);
    const extraTouch = TOUCH_DEVICE ? gap + 13 : 0;
    const hTotal = 24 + gap + hChamp + gap + 13 + gap + 13 + extraTouch + gap + hPodium;
    return Math.round((HEIGHT - hTotal) / 2) + 24 + gap;
}

function zoneChampPseudo() {
    const pad = 22;
    return {
        x: pad,
        y: yChampPseudoAccueil(),
        w: WIDTH - pad * 2,
        h: 34,
    };
}

function pointDansZone(point, zone) {
    return point.x >= zone.x && point.x <= zone.x + zone.w
        && point.y >= zone.y && point.y <= zone.y + zone.h;
}

function filtrerPseudo(valeur) {
    return valeur.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, PSEUDO_MAX);
}

function mettreAJourChampPseudoInput() {
    if (!pseudoInput) return;

    if (phase !== "accueil") {
        pseudoInput.classList.remove("visible");
        pseudoInput.blur();
        return;
    }

    const zone = zoneChampPseudo();
    const scaleY = canvas.clientHeight / HEIGHT;

    // Position inside #jeu-wrap with canvas percentages (stable on phone)
    pseudoInput.style.left = (zone.x / WIDTH * 100) + "%";
    pseudoInput.style.top = (zone.y / HEIGHT * 100) + "%";
    pseudoInput.style.width = (zone.w / WIDTH * 100) + "%";
    pseudoInput.style.height = (zone.h / HEIGHT * 100) + "%";
    pseudoInput.style.fontSize = Math.max(10, 12 * scaleY) + "px";
    pseudoInput.style.lineHeight = (zone.h * scaleY) + "px";
    pseudoInput.classList.add("visible");

    if (document.activeElement !== pseudoInput) {
        pseudoInput.value = pseudo;
    }
}

function focusChampPseudo() {
    if (!pseudoInput || phase !== "accueil") return;
    mettreAJourChampPseudoInput();
    pseudoInput.focus();
    if (pseudoInput.setSelectionRange) {
        const fin = pseudoInput.value.length;
        pseudoInput.setSelectionRange(fin, fin);
    }
}

function dessinerChampPseudo(yHaut) {
    const pad = 22;
    const boxW = WIDTH - pad * 2;
    const boxH = 34;
    const x = pad;
    const y = yHaut;
    const inputActif = pseudoInput && document.activeElement === pseudoInput;

    ctx.fillStyle = "#543847";
    ctx.fillRect(x - 2, y - 2, boxW + 4, boxH + 4);
    ctx.fillStyle = "#fff5cc";
    ctx.fillRect(x, y, boxW, boxH);

    // Text is typed in the HTML input on phone (and when the input is focused)
    if (inputActif) {
        ctx.textAlign = "left";
        return;
    }

    const texte = pseudoActuel();
    ctx.font = "12px " + FONT_PIXEL;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = texte ? "#543847" : "#b3a97a";
    ctx.fillText(texte || "Ton pseudo", Math.round(WIDTH / 2), Math.round(y + 22));

    if (Math.floor(Date.now() / 500) % 2 === 0) {
        const largeurTexte = ctx.measureText(texte).width;
        const curseurX = WIDTH / 2 + largeurTexte / 2 + 3;
        ctx.fillStyle = "#fc7e38";
        ctx.fillRect(curseurX, y + 10, 3, 14);
    }

    ctx.textAlign = "left";
}

function dessinerPodiumCanvas(ligneMax, debutY) {
    const podium = lirePodium().slice(0, ligneMax);
    const bordures = ["#ffd700", "#c0c0c0", "#cd7f32", null, null];
    const emojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    const pad = 22;
    const rowW = WIDTH - pad * 2;
    const y0 = debutY ?? (ligneMax >= PODIUM_MAX ? 292 : 295);

    if (podium.length === 0) {
        dessinerTexte("Aucun score", WIDTH / 2, y0 + 20, 8, "#8a7f5c", true, false);
        return;
    }

    if (ligneMax < PODIUM_MAX) {
        dessinerEmojiEtTexte("🏆", "Podium", WIDTH / 2, y0 - 22, 10, "#543847", 4);
    }

    podium.forEach((entry, index) => {
        const rowY = y0 + index * 28;
        const rowH = 24;

        ctx.fillStyle = "#543847";
        ctx.fillRect(pad - 2, rowY - 2, rowW + 4, rowH + 4);
        ctx.fillStyle = "#fff5cc";
        ctx.fillRect(pad, rowY, rowW, rowH);

        if (bordures[index]) {
            ctx.fillStyle = bordures[index];
            ctx.fillRect(pad, rowY, 4, rowH);
        }

        dessinerEmojiNomScore(
            emojis[index],
            entry.nom,
            formaterScore(entry.score),
            pad + 8,
            rowY + rowH / 2,
            rowW - 16
        );
    });
}

function hauteurBlocPodium(ligneMax) {
    const podium = lirePodium().slice(0, ligneMax);
    if (podium.length === 0) return 24;
    return podium.length * 28;
}

function dessinerDeblocageSkin() {
    if (!skinDebloquePopup || skinDebloqueFin <= Date.now()) return;

    const restant = skinDebloqueFin - Date.now();
    const alpha = restant < 400 ? restant / 400 : 1;
    const cx = WIDTH / 2;
    const skin = skinDebloquePopup;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = "#543847";
    ctx.fillRect(cx - 120, 6, 240, 76);
    ctx.fillStyle = "#fff5cc";
    ctx.fillRect(cx - 117, 9, 234, 70);

    dessinerTexte("NOUVEAU SKIN!", cx, 30, 10, "#e86101", true, false);

    // Draw the unlocked bird sprite next to its name
    const img = images[skin.sprite + "-milieu"];
    ctx.font = "11px " + FONT_PIXEL;
    const wNom = ctx.measureText(skin.nom).width;
    const wTotal = img.width + 8 + wNom;
    const xImg = Math.round(cx - wTotal / 2);
    ctx.drawImage(img, xImg, 52 - img.height / 2 + 6);
    dessinerTexte(skin.nom, xImg + img.width + 8 + wNom / 2, 62, 11, "#543847", true, false);

    ctx.restore();
}

function dessinerBestScore() {
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    ctx.save();
    ctx.fillStyle = "rgba(84, 56, 71, 0.85)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#fff5cc";
    ctx.fillRect(20, cy - 130, WIDTH - 40, 260);
    ctx.fillStyle = "#543847";
    ctx.fillRect(24, cy - 126, WIDTH - 48, 252);
    ctx.fillStyle = "#ded895";
    ctx.fillRect(28, cy - 122, WIDTH - 56, 244);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "64px " + FONT_EMOJI;
    ctx.fillText("👑", cx, cy - 56);

    ctx.font = "34px " + FONT_PIXEL;
    ctx.strokeStyle = "#543847";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.strokeText(formaterScore(scoreMaxPartie), cx, cy + 16);
    ctx.fillStyle = "#fff";
    ctx.fillText(formaterScore(scoreMaxPartie), cx, cy + 16);

    ctx.font = "13px " + FONT_PIXEL;
    ctx.fillStyle = "#e86101";
    ctx.fillText("BEST SCORE", cx, cy + 76);

    ctx.restore();
}

function ecranAccueil() {
    dessinerPanneauPixel();

    const gap = 16;
    const hChamp = 34;
    const hPodium = 15 + 10 + hauteurBlocPodium(PODIUM_MAX);
    const extraTouch = TOUCH_DEVICE ? gap + 13 : 0;
    const hTotal = 24 + gap + hChamp + gap + 13 + gap + 13 + extraTouch + gap + hPodium;
    let y = Math.round((HEIGHT - hTotal) / 2);

    y += 24;
    dessinerTexte("FLAPPY BIRD", WIDTH / 2, y, 16, "#fff", true);
    y += gap;
    dessinerChampPseudo(yChampPseudoAccueil());
    y += hChamp + gap + 13;
    dessinerTexte(TOUCH_DEVICE ? "Tape ton pseudo" : "Entree pour jouer", WIDTH / 2, y, 8, "#543847", true, false);
    y += gap + 13;
    if (TOUCH_DEVICE) {
        dessinerTexte("OK sur le clavier pour jouer", WIDTH / 2, y, 7, "#8a7f5c", true, false);
        y += gap + 13;
    }
    dessinerTexte("3 vies", WIDTH / 2, y, 8, "#e86101", true, false);
    y += gap + 15;
    dessinerEmojiEtTexte("🏆", "PODIUM", WIDTH / 2, y, 10, "#543847", 4);
    y += 10;
    dessinerPodiumCanvas(PODIUM_MAX, y);
    mettreAJourChampPseudoInput();
}

function ecranSkins() {
    dessinerPanneauPixel();
    assurerSkinDebloque();
    const skin = skinActif();
    const debloques = skinsDebloques();
    const prochain = prochainSkinDebloque();
    const z = zoneNourrirSkins();
    const actif = messageNourrirVisible;

    dessinerBarreNourrir(actif);

    const gap = 14;
    const hPreview = 80;
    const hTotal = z.h + 12 + 18 + gap + hPreview + gap + 16 + gap + 12 + gap + 12 + gap + 12;
    let y = Math.round((HEIGHT - hTotal) / 2) + z.h + 8;

    dessinerTexte("TON OISEAU", WIDTH / 2, y, 12, "#fff", true);
    y += gap;

    const boxY = y;
    dessinerOiseauCentre(boxY + hPreview / 2, 2.5);

    y += hPreview + gap + 16;
    dessinerTexte(skin.nom, WIDTH / 2, y, 12, "#543847", true, false);
    y += gap + 12;
    dessinerTexte(debloques.length + "/" + SKINS.length + " skins", WIDTH / 2, y, 8, "#8a7f5c", true, false);
    y += gap + 12;
    if (prochain) {
        dessinerTexte(prochain.nom + " a " + prochain.scoreDeblocage + " pts", WIDTH / 2, y, 7, "#e86101", true, false);
        y += gap + 12;
    }
    dessinerTexte("< > pour changer", WIDTH / 2, y, 8, "#543847", true, false);
    y += gap + 12;
    dessinerTexte("ESPACE pour jouer", WIDTH / 2, y, 8, "#4ba828", true, false);

    const dotY = y + 20;
    const dotSpacing = 14;
    const dotsW = (SKINS.length - 1) * dotSpacing;
    SKINS.forEach((s, i) => {
        const debloque = skinEstDebloque(s);
        const dx = Math.round(WIDTH / 2 - dotsW / 2 + i * dotSpacing);
        const taille = i === skinIndex ? 8 : 6;
        ctx.fillStyle = !debloque ? "#b3a97a" : i === skinIndex ? "#e86101" : "#543847";
        ctx.fillRect(dx - taille / 2, dotY - taille / 2, taille, taille);
    });

    // Feed instruction overlay
    if (messageNourrirVisible) {
        ctx.fillStyle = "rgba(84, 56, 71, 0.85)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#543847";
        ctx.fillRect(14, HEIGHT / 2 - 46, WIDTH - 28, 92);
        ctx.fillStyle = "#fff5cc";
        ctx.fillRect(17, HEIGHT / 2 - 43, WIDTH - 34, 86);
        dessinerTexte('APPUYER SUR "F"', WIDTH / 2, HEIGHT / 2 - 24, 8, "#e86101", true, false);
        dessinerTexte("POUR NOURRIR", WIDTH / 2, HEIGHT / 2 - 10, 8, "#543847", true, false);
        dessinerTexte("TON OISEAU", WIDTH / 2, HEIGHT / 2 + 4, 8, "#543847", true, false);
        dessinerTexte("(" + COUT_NOURRIR + " gemmes)", WIDTH / 2, HEIGHT / 2 + 18, 7, "#8a7f5c", true, false);
        dessinerTexte("puis F pour confirmer", WIDTH / 2, HEIGHT / 2 + 32, 7, "#8a7f5c", true, false);
        dessinerBarreNourrir(true);
    }

    if (nourrirErreurFin > Date.now()) {
        dessinerTexte(nourrirErreurMsg, WIDTH / 2, HEIGHT - 58, 8, "#d32f00", true, false);
    }

    if (nourrirFeedbackFin > Date.now()) {
        dessinerTexte("Ameliore! Nv." + lireNiveau(), WIDTH / 2, HEIGHT - 58, 8, "#4ba828", true, false);
    }
}

function ecranGameOver() {
    dessinerPanneauPixel("nuit");

    const gap = 14;
    const hPodium = 15 + 10 + hauteurBlocPodium(PODIUM_MAX);
    const hTotal = 22 + gap + 16 + gap + 16 + gap + 15 + gap + hPodium + gap + 13;
    let y = Math.round((HEIGHT - hTotal) / 2);

    y += 22;
    dessinerTexte("GAME OVER", WIDTH / 2, y, 16, "#fff", true);
    y += gap + 16;
    dessinerEmojiEtTexte("👤", pseudoActuel(), WIDTH / 2, y, 10, "#543847", 4);
    y += gap + 16;
    dessinerEmojiEtTexte("🎯", "Score " + formaterScore(scoreMaxPartie), WIDTH / 2, y, 10, "#543847", 4);
    y += gap + 15;
    dessinerEmojiEtTexte("⭐", "Record " + formaterScore(meilleurScoreJoueur()), WIDTH / 2, y, 9, "#8a7f5c", 4);
    y += gap + 12;
    if (gemmesGagneesPartie > 0) {
        dessinerEmojiEtTexte("💎", "+" + gemmesGagneesPartie + " gemme" + (gemmesGagneesPartie > 1 ? "s" : ""), WIDTH / 2, y, 8, "#e86101", 2);
        y += gap + 12;
    }
    dessinerEmojiEtTexte("🏆", "PODIUM", WIDTH / 2, y, 10, "#543847", 4);
    y += 10;
    dessinerPodiumCanvas(PODIUM_MAX, y);
    y += hauteurBlocPodium(PODIUM_MAX) + gap + 13;
    dessinerTexte("ESPACE pour rejouer", WIDTH / 2, y, 8, "#4ba828", true, false);

    if (nouveauBestScore) {
        dessinerBestScore();
    }
}

// --- Draw ---
function dessiner() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if (phase === "accueil") {
        ecranAccueil();
        return;
    }

    if (phase === "skins") {
        ecranSkins();
        return;
    }

    if (phase === "mort") {
        ecranGameOver();
        return;
    }

    ctx.drawImage(images["fond-jour"], 0, 0, WIDTH, HEIGHT);

    dessinerOiseauCentre(oiseauY, 1, inclinaisonOiseau());

    const tuyauBas = images["tuyau-vert-bas"];
    const tuyauHaut = images["tuyau-vert-haut"];
    const tW = tuyauBas.width;

    for (const tuyau of tuyaux) {
        ctx.drawImage(tuyauHaut, tuyau.x, 0, tW, tuyau.gapTop);
        const basY = tuyau.gapTop + ESPACE_TUYAUX;
        ctx.drawImage(tuyauBas, tuyau.x, basY, tW, HEIGHT - basY);
    }

    // Big centered score at the top, like the original
    dessinerTexte(formaterScore(score), WIDTH / 2, 52, 24, "#fff", true);

    dessinerTexte("Vies " + vies, 10, 24, 8, "#fff", false);
    dessinerTexte("Record " + formaterScore(meilleurScoreJoueur()), 10, 42, 8, "#fff", false);

    const infoMode = libelleMode();
    if (infoMode) {
        dessinerTexte(infoMode.texte, 10, 64, 8, infoMode.couleur, false);
    }

    dessinerDeblocageSkin();
}

// --- Update ---
function mettreAJour(dt) {
    if (phase !== "jeu") return;

    oiseauVY += graviteEffective() * dt;
    if (oiseauVY > VITESSE_MAX_CHUTE) oiseauVY = VITESSE_MAX_CHUTE;
    oiseauY += oiseauVY * dt;

    const vitesse = vitesseActuelle();
    const tW = largeurTuyau();

    for (const tuyau of tuyaux) {
        tuyau.x -= vitesse * dt;
    }

    tuyaux = tuyaux.filter((t) => t.x + tW > 0);
    assurerTuyaux();

    const dim = dimensionsOiseau();
    const ox = WIDTH / 2 - dim.w / 2;
    const oy = oiseauY - dim.h / 2;

    for (const tuyau of tuyaux) {
        const basY = tuyau.gapTop + ESPACE_TUYAUX;

        if (
            rectsCollident(ox, oy, dim.w, dim.h, tuyau.x, 0, tW, tuyau.gapTop) ||
            rectsCollident(ox, oy, dim.w, dim.h, tuyau.x, basY, tW, HEIGHT - basY)
        ) {
            perdreVie();
            return;
        }

        if (!tuyau.score && ox > tuyau.x + tW) {
            tuyau.score = true;
            ajouterScore(pointsParTuyau());
        }
    }

    if (oiseauY < 0 || oiseauY > HEIGHT) {
        perdreVie();
    }
}

// --- Game loop ---
function boucle(temps) {
    if (dernierTemps === null) dernierTemps = temps;
    let dt = (temps - dernierTemps) / 1000;
    dernierTemps = temps;
    if (dt > DT_MAX) dt = DT_MAX;

    mettreAJour(dt);
    dessiner();
    requestAnimationFrame(boucle);
}

// --- Controls ---
function peutDemarrer() {
    return pseudoActuel().length > 0;
}

function gererSaisiePseudo(e) {
    if (e.key === "Backspace") {
        e.preventDefault();
        pseudo = pseudo.slice(0, -1);
        return;
    }

    if (e.key === "Enter") {
        e.preventDefault();
        allerChoixSkin();
        return;
    }

    if (e.key.length === 1 && pseudo.length < PSEUDO_MAX) {
        const char = e.key;
        if (/^[a-zA-Z0-9 _-]$/.test(char)) {
            e.preventDefault();
            pseudo = filtrerPseudo(pseudo + char);
        }
    }
}

function allerChoixSkin() {
    if (!peutDemarrer()) return;
    pseudo = filtrerPseudo(pseudoInput ? pseudoInput.value : pseudo);
    if (pseudoInput) pseudoInput.blur();
    localStorage.setItem(PSEUDO_KEY, pseudo);
    const saved = localStorage.getItem(SKIN_KEY);
    const idx = SKINS.findIndex((s) => s.id === saved);
    skinIndex = idx >= 0 ? idx : 0;
    assurerSkinDebloque();
    messageNourrirVisible = false;
    phase = "skins";
    canvas.focus();
}

function confirmerSkin() {
    assurerSkinDebloque();
    localStorage.setItem(SKIN_KEY, SKINS[skinIndex].id);
    phase = "jeu";
    scoreEnregistre = false;
    resetPartie();
    canvas.focus();
}

function gererChoixSkin(e) {
    if (toucheEstF(e)) {
        e.preventDefault();
        gererToucheNourrir();
        return;
    }
    if (e.key === "Escape" && messageNourrirVisible) {
        e.preventDefault();
        messageNourrirVisible = false;
        return;
    }
    if (messageNourrirVisible) return;

    if (e.key === "ArrowLeft") {
        e.preventDefault();
        changerSkin(-1);
        return;
    }
    if (e.key === "ArrowRight") {
        e.preventDefault();
        changerSkin(1);
        return;
    }
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        confirmerSkin();
    }
}

function retourAccueil() {
    phase = "accueil";
    score = 0;
    vies = 3;
    scoreMaxPartie = 0;
    gemmesGagneesPartie = 0;
    scoreEnregistre = false;
    nouveauBestScore = false;
    skinDebloquePopup = null;
    skinDebloqueFin = 0;
    messageNourrirVisible = false;
    mode = "normal";
    canvas.focus();
}

function coordCanvasDepuisEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (WIDTH / rect.width),
        y: (e.clientY - rect.top) * (HEIGHT / rect.height),
    };
}

canvas.addEventListener("click", (e) => {
    if (phase === "accueil") {
        const p = coordCanvasDepuisEvent(e);
        if (pointDansZone(p, zoneChampPseudo())) {
            focusChampPseudo();
        }
        return;
    }

    canvas.focus();
    if (phase === "skins") {
        const p = coordCanvasDepuisEvent(e);
        const z = zoneNourrirSkins();
        if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) {
            messageNourrirVisible = true;
        }
        return;
    }
    if (phase === "jeu") {
        flap();
    }
});

canvas.addEventListener("touchstart", (e) => {
    if (phase === "accueil") {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const p = {
            x: (touch.clientX - rect.left) * (WIDTH / rect.width),
            y: (touch.clientY - rect.top) * (HEIGHT / rect.height),
        };
        if (pointDansZone(p, zoneChampPseudo())) {
            e.preventDefault();
            focusChampPseudo();
        }
        return;
    }

    if (phase !== "jeu") return;
    e.preventDefault();
    canvas.focus();
    flap();
}, { passive: false });

function demarrerPartie() {
    confirmerSkin();
}

document.addEventListener("keydown", (e) => {
    if (phase === "accueil") {
        gererSaisiePseudo(e);
        return;
    }

    if (phase === "skins") {
        gererChoixSkin(e);
        return;
    }

    const touche = e.key.toLowerCase();

    if (touche === "a") activerMode("rapide");
    if (touche === "z") activerMode("lent");
    if (touche === "e") activerMode("ultra_rapide");
    if (touche === "r") activerMode("ultra_lent");

    if (e.key === " ") {
        e.preventDefault();
        if (phase === "mort") {
            retourAccueil();
            return;
        }
        if (phase === "jeu") {
            if (mode !== "normal") {
                mode = "normal";
            } else {
                flap();
            }
            return;
        }
        return;
    }

    if (phase !== "jeu") return;

    if (e.key === "ArrowUp") {
        e.preventDefault();
        flap();
    }
});

if (pseudoInput) {
    pseudoInput.addEventListener("input", () => {
        pseudo = filtrerPseudo(pseudoInput.value);
        pseudoInput.value = pseudo;
    });

    pseudoInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            allerChoixSkin();
        }
    });

    pseudoInput.addEventListener("blur", () => {
        pseudo = filtrerPseudo(pseudoInput.value);
        pseudoInput.value = pseudo;
    });

    pseudoInput.addEventListener("focus", () => {
        setTimeout(mettreAJourChampPseudoInput, 50);
    });
}

window.addEventListener("resize", mettreAJourChampPseudoInput);
if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", mettreAJourChampPseudoInput);
    window.visualViewport.addEventListener("scroll", mettreAJourChampPseudoInput);
}
canvas.focus();
