# Grade 9 experiment catalog and validation

The Modules tab opens **Quarter → Module → Experiment** for students and teachers. The catalog contains twelve experiments across five modules: Q1 motion and circuits, Q2 Earth's interior, Q3 DNA and mutation, and Q4 chemical bonding and change. Each experiment has its own Predict, Observe, and Explain records and feedback.

`backend/src/data/modules.ts` is the canonical catalog, also imported by the offline frontend. Keep the repository's backend source available when building the frontend. Database `Module` rows represent individual experiments; no schema migration is required. Seed and sync upsert the new IDs. Retired experiment IDs are retained during sync so historical/offline records remain valid; they do not count toward the new curriculum's completion.

Both viewing modes use the same procedural models, controls, and calculations. AR content faces the camera while its position follows the marker. AR trials require current marker detection. Students can continue comparing local trials after saving their observation, but replacing the saved submission requires a teacher reset.

## Automated checks

```sh
npm run db:generate
npm run typecheck
npm run build
npm run test:experiments
```

The science checks cover catalog grouping, every slider value, zero-force motion, series resistance and brightness, independent parallel branches, fuse overload, gas formation, seismic transmission, complementary DNA, the genetic code, frameshifts, and Earth dimensions.

For browser checks, use Node 22+ and a dedicated headless Chrome instance with `--remote-debugging-port=9222`, a temporary `--user-data-dir`, and software WebGL enabled if needed. Start Vite on port 5174 and run:

```sh
npm run dev --workspace frontend -- --port 5174
# In another terminal:
npm run test:browser
```

Set `TEST_ORIGIN` for another local port. The script mocks authentication/API responses and supplies a canvas video stream containing the existing Tuklas marker image. AR.js performs actual pattern detection on that stream; marker visibility is toggled to test loss and reacquisition. It visits all twelve experiments at a 390 × 844 viewport, changes controls, captures 3D/AR screenshots under `.browser-check/screens`, checks trial gating and page overflow, and fails on browser exceptions. It does not use a physical camera or send student work to an API.

## Physical-device acceptance

Automated camera-feed checks cannot establish real-world tracking quality. On a phone over HTTPS or localhost, grant camera permission and test the printed Tuklas marker under ordinary classroom lighting. Verify each experiment remains legible at several viewing angles and distances, hides after marker loss, resumes after reacquisition, and releases the camera when switching modes or leaving Observe. Repeat in portrait and landscape.

## Scientific scope

- Motion uses a frictionless track that wraps at its edge to keep the cart visible. Force and mass determine acceleration, and the launcher displays equal forces acting on different objects.
- Circuits use ideal batteries, identical resistive bulbs, and brightness proportional to electrical power. The home designer is a virtual low-voltage circuit with a 1.5 A overload cutoff.
- Vinegar/baking-soda amounts are qualitative, not stoichiometric measurements. Bonding shows valence-electron transfer and shared pairs.
- The seismic sample demonstrates longitudinal/transverse displacement and liquid transmission; it is not a global ray-path simulation. See [USGS: Earth's interior](https://pubs.usgs.gov/gip/interior/).
- The Earth cross-section uses true radial proportions. A separate surface view magnifies shallow depth by ten; lithosphere and asthenosphere are mechanical regions overlapping compositional layers. Representative boundaries vary by location. See [USGS: Inside the Earth](https://pubs.usgs.gov/gip/dynamic/inside.html).
- DNA translation uses the standard code and a fixed coding-strand reading frame. The model reports possible protein effects, without assigning a deterministic trait. See [NHGRI: Frameshift Mutation](https://www.genome.gov/genetics-glossary/Frameshift-Mutation).
