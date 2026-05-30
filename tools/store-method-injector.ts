import * as fs from 'fs';
import * as path from 'path';

const storePath = path.join(process.cwd(), 'apps/studio/src/store/studio-store.ts');
let content = fs.readFileSync(storePath, 'utf8');

const importAdd = `import { generateAndRankCounterfactuals } from "@/simulation/counterfactual-engine";
import type { CounterfactualConstraint, CounterfactualPlan, CounterfactualAction } from "@/schema/security-scene";`;

if (!content.includes('generateAndRankCounterfactuals')) {
  content = content.replace('import { simulateStudio } from "@/simulation/simulate-studio";', importAdd + '\nimport { simulateStudio } from "@/simulation/simulate-studio";');
}

const interfaceRegex = /  counterfactualResult: SimulationResult \| null;\n  counterfactualObsId: string \| null;\n  sceneIntelligenceGraph: SceneIntelligenceGraph;\n  runCounterfactual: \(obstructionId: string\) => void;\n  clearCounterfactual: \(\) => void;/;
const interfaceReplace = `  counterfactualResult: SimulationResult | null;
  counterfactualObsId: string | null;
  counterfactualPlans: CounterfactualPlan[];
  activeCounterfactualPlanId: string | null;
  sceneIntelligenceGraph: SceneIntelligenceGraph;
  runCounterfactual: (obstructionId: string) => void;
  clearCounterfactual: () => void;
  generateCounterfactuals: (constraints: CounterfactualConstraint) => void;
  previewCounterfactualPlan: (planId: string) => void;
  applyCounterfactualPlan: (planId: string) => void;
  revertCounterfactualPreview: () => void;`;

content = content.replace(interfaceRegex, interfaceReplace);

const implRegex = /  counterfactualResult: null,\n  counterfactualObsId: null,\n  runCounterfactual: \(obstructionId\) => {[\s\S]*? clearCounterfactual: \(\) => set\(\{ counterfactualResult: null, counterfactualObsId: null \}\),/;

const implReplace = `  counterfactualResult: null,
  counterfactualObsId: null,
  counterfactualPlans: [],
  activeCounterfactualPlanId: null,
  runCounterfactual: (obstructionId) => {
    const { scene } = get();
    const patched = cloneSecurityScene(scene);
    patched.obstructions = scene.obstructions.filter((o) => o.id !== obstructionId);
    const result = simulateStudio(patched);
    const evidenceEvent = buildOperationalEvidenceEvent({
      kind: "counterfactual_completed",
      title: "Counterfactual simulated",
      details: \`Recomputed coverage without obstruction \${obstructionId}.\`,
      actor: "system",
      source: scene.source,
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: get().historyPast.length,
      affectedNodeIds: [obstructionId],
      confidence: 0.9,
      beforeSummary: summarizeSceneEvidence(scene).detail,
      afterSummary: summarizeSceneEvidence(patched).detail,
      simulation: summarizeSimulationEvidence(result)
        ? {
            ...summarizeSimulationEvidence(result)!,
            deltaCoveragePct: null,
          }
        : undefined,
    });
    const nextEvents = [...get().operationalEvidenceEvents, evidenceEvent];
    persistOperationalEvidenceEvents(nextEvents);
    set({
      counterfactualResult: result,
      counterfactualObsId: obstructionId,
      operationalEvidenceEvents: nextEvents,
      scene: {
        ...cloneSecurityScene(scene),
        changeLog: [...scene.changeLog, evidenceLogLine(evidenceEvent)],
      },
    });
  },
  clearCounterfactual: () => set({ counterfactualResult: null, counterfactualObsId: null }),

  generateCounterfactuals: (constraints) => {
    const { scene } = get();
    if (!scene.simulation) return;
    const plans = generateAndRankCounterfactuals(scene, scene.simulation, constraints);
    set({ counterfactualPlans: plans, activeCounterfactualPlanId: null });
  },

  previewCounterfactualPlan: (planId) => {
    const state = get();
    const plan = state.counterfactualPlans.find((p: any) => p.planId === planId);
    if (!plan) return;
    
    let patched = cloneSecurityScene(state.scene);
    for (const action of plan.actions) {
      if (action.type === "move_object" && action.affectedNodeId && action.suggestedPosition) {
        const obs = patched.obstructions.find((o: any) => o.id === action.affectedNodeId);
        if (obs) obs.position = action.suggestedPosition;
      } else if (action.type === "rotate_camera" && action.affectedNodeId) {
        const cam = patched.cameras.find((c: any) => c.id === action.affectedNodeId);
        if (cam) {
          if (action.suggestedYawDeg !== undefined) cam.yawDeg = action.suggestedYawDeg;
          if (action.suggestedPitchDeg !== undefined) cam.pitchDeg = action.suggestedPitchDeg;
        }
      } else if (action.type === "add_camera" && action.suggestedPosition) {
        patched.cameras.push({
          id: \`cam_cf_\${Date.now()}\`,
          nodeType: "camera",
          name: "Suggested Camera",
          position: action.suggestedPosition,
          yawDeg: action.suggestedYawDeg ?? 0,
          pitchDeg: action.suggestedPitchDeg ?? -30,
          rollDeg: 0,
          mountType: "wall",
          mountHeightM: 2.5,
          fovHorizontalDeg: 90,
          fovVerticalDeg: 50,
          rangeM: 20,
          resolutionMP: 4,
          lensType: "fixed",
          status: "on",
          nightMode: "ir",
          irRangeM: 15,
          thermalCapable: false,
          ptz: false,
          clarity: "good",
          ndaaCompliant: true,
          privacyMaskingEnabled: false,
          source: "ai",
          tags: [],
          reviewStatus: "unreviewed",
          sourceTrace: "",
          geometryValidity: "valid",
        });
      }
    }
    
    if (plan.simulationResult) {
      patched.simulation = plan.simulationResult;
    }
    
    set({ scene: patched, activeCounterfactualPlanId: planId });
  },

  applyCounterfactualPlan: (planId) => {
    const state = get();
    const plan = state.counterfactualPlans.find((p: any) => p.planId === planId);
    if (!plan) return;
    
    const evidenceEvent = buildOperationalEvidenceEvent({
      kind: "counterfactual_completed",
      title: \`Applied Plan: \${plan.label}\`,
      details: \`Applied optimization plan \${planId}\`,
      actor: "system",
      source: state.scene.source,
      sceneId: state.scene.id,
      sceneName: state.scene.name,
      revisionDepth: get().historyPast.length,
      affectedNodeIds: [],
      confidence: plan.confidenceScore,
      beforeSummary: "",
      afterSummary: summarizeSceneEvidence(state.scene).detail,
      simulation: state.scene.simulation ? summarizeSimulationEvidence(state.scene.simulation) as any : undefined,
    });
    const nextEvents = [...get().operationalEvidenceEvents, evidenceEvent];
    persistOperationalEvidenceEvents(nextEvents);
    
    set({
      activeCounterfactualPlanId: null,
      operationalEvidenceEvents: nextEvents,
      scene: {
        ...cloneSecurityScene(state.scene),
        changeLog: [...state.scene.changeLog, evidenceLogLine(evidenceEvent)],
      }
    });
    
    get().saveSnapshot(\`Applied fix: \${plan.label}\`);
  },

  revertCounterfactualPreview: () => {
    get().undo();
    set({ activeCounterfactualPlanId: null });
  },`;

content = content.replace(implRegex, implReplace);
fs.writeFileSync(storePath, content, 'utf8');
console.log('Patched studio-store.ts successfully');
