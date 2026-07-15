// Shared podium API — stores a small JSON file in Vercel Blob.
// GET  /api/podium            -> returns the top scores list
// POST /api/podium {nom,score} -> adds/updates a score, returns the new list

const { put, list } = require("@vercel/blob");

const BLOB_PATH = "podium.json";
const PSEUDO_MAX = 12;

// "Marlow", "MARLOW" and "marlow" are the same player
function memeNom(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Read the current podium from the blob (empty list if none yet)
async function lirePodiumBlob() {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    if (blobs.length === 0) return [];

    // Cache-buster so we always get the latest version
    const reponse = await fetch(blobs[0].url + "?ts=" + Date.now(), { cache: "no-store" });
    if (!reponse.ok) return [];

    const podium = await reponse.json();
    return Array.isArray(podium) ? podium : [];
}

// Write the podium back to the blob
async function sauverPodiumBlob(podium) {
    await put(BLOB_PATH, JSON.stringify(podium), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
    });
}

module.exports = async (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "GET") {
        const podium = await lirePodiumBlob();
        res.status(200).json(podium);
        return;
    }

    if (req.method === "POST") {
        const { nom, score } = req.body || {};
        const nomPropre = String(nom || "").trim().slice(0, PSEUDO_MAX);
        const scorePropre = Number(score);

        // Only accept a real name and a positive score
        if (!nomPropre || !Number.isFinite(scorePropre) || scorePropre <= 0) {
            res.status(400).json({ erreur: "nom ou score invalide" });
            return;
        }

        let podium = await lirePodiumBlob();
        const index = podium.findIndex((entry) => memeNom(entry.nom, nomPropre));

        if (index >= 0) {
            // Same player: keep the best score and the first spelling
            if (scorePropre > podium[index].score) {
                podium[index].score = scorePropre;
            }
        } else {
            podium.push({ nom: nomPropre, score: scorePropre });
        }

        podium.sort((a, b) => b.score - a.score);

        await sauverPodiumBlob(podium);
        res.status(200).json(podium);
        return;
    }

    res.status(405).json({ erreur: "methode non autorisee" });
};
