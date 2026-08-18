# CerviTrust

**Privacy-preserving, Bayesian AI pipeline for cervical cancer screening: from cell to decision, without ever sharing an image.**

🏆 1st place in Hackathon IA Santé, Track 4 (Imagerie cervicale)

CerviTrust is an on-premise AI assistant that helps pathologists triage and prioritize high-risk cervical cytology cases. Every image is analyzed **locally at the hospital** (no cloud, no data transfer) and every prediction comes with a **quantified Bayesian uncertainty margin**, not just a raw confidence score.

> *"CerviTrust does not replace the pathologist: it prioritizes, explains, and protects, so that more women are diagnosed in time without ever compromising medical confidentiality."*

---

## Why

- **67%** — screening coverage gap affecting millions of women
- **84% vs 9%** — the disparity in access to screening between high- and low-resource settings
- Cloud-based alternatives require sending medical images to remote servers; CerviTrust guarantees **zero image egress**.

| Criterion | Manual screening | Cloud AI platforms | **CerviTrust** |
|---|---|---|---|
| Data confidentiality | No digital transfer | Images sent to remote servers | **Zero leakage — images never leave the hospital** |
| Infrastructure | Saturated qualified staff | Stable internet + vendor cloud required | **Runs on existing machines** |
| Diagnostic uncertainty | Fatigue-prone, unquantifiable | Simple confidence score | **Rigorous Bayesian uncertainty displayed** |
| Operating cost | Slow, labor-intensive | Recurring per-volume cloud fees | **Near-zero marginal inference cost** |

---

## How it works — the pipeline

```
 A. Segmentation ──► B. Classification ──► C. Federated learning ──► D. MIL aggregation ──► E. Explainability
    HoVer-Net           EfficientNet-B0        Flower + posterior        CLAM-style             Grad-CAM +
    nuclear             + Laplace              fusion                    attention              uncertainty
    contouring          (Bayesian head)                                  (cell → slide)         visualization
```

| Stage | Method | Details |
|---|---|---|
| **A Segmentation** | HoVer-Net (`hovernet_fast-pannuke`, via tiatoolbox) | Nuclear instance segmentation; individual cell crops extracted from whole images |
| **B Classification** | EfficientNet-B0 (timm) + last-layer **Laplace approximation** | Trained on SIPaKMeD + Herlev (merged), Focal Loss + class weights, F1-macro model selection; outputs class + σ (uncertainty) |
| **C Federated learning** | Flower | Multi-site training and posterior fusion — models travel, images never do |
| **D Aggregation** | CLAM-style attention MIL | From cell-level predictions to a slide-level verdict |
| **E Explainability** | Grad-CAM (target layer `blocks.2`) | Heatmaps localizing the evidence behind each prediction |

**Uncertainty that means something:** incorrect predictions carry measurably higher σ than correct ones so the pathologist knows *when to trust* the model, not just what it predicts.

---


The **web platform** (TypeScript/Next.js) is the clinician-facing interface: upload a scanned slide, view segmented cells, per-cell classifications with uncertainty, Grad-CAM heatmaps, and the aggregated slide-level verdict. 
---



## Model training

The full training pipeline is included in Training/ as a Kaggle notebook. It covers:

Segmentation: HoVer-Net inference on Cx22, evaluated with pixel-level Dice / IoU / precision / recall, plus qualitative overlays
Classification: EfficientNet-B0 on SIPaKMeD + Herlev merged into a single dataset, stratified splits, cytology-specific augmentation (flips, ±15° rotation, mild affine/jitter — no elastic or extreme crops that would distort nuclear morphology), class weights + Focal Loss, model selection on F1-macro, ReduceLROnPlateau and early stopping
Laplace fitting: last-layer Bayesian posterior, validated by checking that σ is higher on incorrect predictions than correct ones
Grad-CAM validation: heatmaps on blocks.2 (not conv_head, which is too coarse at 64×64 crops)

It runs on Kaggle with the datasets mounted under /kaggle/input/ and exports the model_bundle/ this platform loads:

efficientnet_b0.pt:  trained classifier (MAP weights)
laplace_state.pt: fitted Laplace posterior (last layer)
hovernet_fast-pannuke.pth: pre-trained segmentation weights

**Datasets:** [SIPaKMeD](https://www.cs.uoi.gr/~marina/sipakmed.html) · Herlev · Cx22 (segmentation ground truth)

**Key results:** 89.8% accuracy, 0.989 macro AUC on the merged test set; 0.88–0.95 accuracy across federated rounds on asymmetric real-world splits.

---

École Polytechnique de Tunisie (EPT) · ESPRIT

---

## Disclaimer

CerviTrust is a research prototype and **not a certified medical device**. It is designed as a decision-support and triage tool for qualified pathologists, not as a replacement for clinical judgment.
