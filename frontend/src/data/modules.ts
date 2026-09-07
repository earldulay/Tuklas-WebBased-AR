import type { LearningModule } from "../types/domain";

export const modules: LearningModule[] = [
  {
    id: "motion", icon: "motion", title: "Forces and Motion",
    subtitle: "Investigate Newton's second law with a marker-anchored cart.", quarter: "Module 1", time: "15-20 min",
    task: "Predict how changing force and mass affects the motion of a cart.",
    predictions: [
      { question: "What happens to acceleration when force increases but mass stays the same?", choices: ["Acceleration increases", "Acceleration decreases", "Acceleration stays the same"] },
      { question: "What happens to acceleration when mass increases but force stays the same?", choices: ["Acceleration decreases", "Acceleration increases", "Acceleration stays the same"] },
      { question: "Which cart will accelerate fastest?", choices: ["High force and low mass", "Low force and high mass", "Low force and low mass"] },
    ],
    observe: "Run trials with different force and mass values and compare the acceleration readout.",
    overview: "A net force causes an object to accelerate. According to Newton's second law, acceleration increases when force increases and decreases when mass increases. The model represents this relationship as acceleration = force divided by mass.",
  },
  {
    id: "electricity", icon: "electricity", title: "Electric Circuits",
    subtitle: "Build a simple series circuit and observe current changes.", quarter: "Module 2", time: "20-25 min",
    task: "Predict how voltage and resistance affect current in a simple circuit.",
    predictions: [
      { question: "What happens to current when resistance increases at the same voltage?", choices: ["Current decreases", "Current increases", "Current stays the same"] },
      { question: "What happens to current when voltage increases at the same resistance?", choices: ["Current increases", "Current decreases", "Current becomes zero"] },
      { question: "When will the bulb glow brightest?", choices: ["High voltage and low resistance", "Low voltage and high resistance", "Low voltage and low resistance"] },
    ],
    observe: "Adjust voltage and resistance, then compare current and bulb brightness.",
    overview: "Electric current depends on voltage and resistance. Higher voltage pushes more charge through the circuit, while greater resistance reduces the flow. The model follows Ohm's law: current = voltage divided by resistance.",
  },
  {
    id: "materials", icon: "materials", title: "Matter and Chemical Change",
    subtitle: "Heat and cool particles to explore solids, liquids, and gases.", quarter: "Module 3", time: "15-20 min",
    task: "Heat or cool a particle model and observe how matter changes state.",
    predictions: [
      { question: "What happens to particles when matter is heated?", choices: ["They move faster", "They stop moving", "They disappear"] },
      { question: "How are particles arranged in a solid?", choices: ["Tightly packed and ordered", "Far apart and random", "Completely motionless"] },
      { question: "Which state has particles that are farthest apart?", choices: ["Gas", "Liquid", "Solid"] },
    ],
    observe: "Try solid, liquid, and gas temperatures, then compare particle arrangement and motion.",
    overview: "Matter changes state as thermal energy changes. Solid particles remain closely packed and vibrate, liquid particles stay close but slide past one another, and gas particles move quickly with large spaces between them. The particles themselves do not disappear during a state change.",
  },
  {
    id: "life", icon: "life", title: "Life Science",
    subtitle: "Inspect a plant cell and test the functions of its organelles.", quarter: "Module 4", time: "15-20 min",
    task: "Remove or restore a cell organelle and observe which cell function is affected.",
    predictions: [
      { question: "Which organelle controls most cell activities?", choices: ["Nucleus", "Mitochondrion", "Chloroplast"] },
      { question: "Which organelle captures light energy to make food?", choices: ["Chloroplast", "Cell membrane", "Nucleus"] },
      { question: "What happens when an important organelle is removed?", choices: ["Its related function is impaired", "Every function improves", "Nothing can be affected"] },
    ],
    observe: "Remove each organelle one at a time, inspect the model, and record the affected function.",
    overview: "Cell organelles have specialized jobs. The nucleus contains genetic information and directs activities, mitochondria release usable energy, chloroplasts perform photosynthesis, and the cell membrane controls what enters and leaves. Removing a part impairs the function it performs.",
  },
  {
    id: "earth-space", icon: "earth", title: "Earth and Space Systems",
    subtitle: "Separate and inspect Earth's four main internal layers.", quarter: "Module 5", time: "20-25 min",
    task: "Open an Earth model and identify the crust, mantle, outer core, and inner core.",
    predictions: [
      { question: "Which layer is at Earth's surface?", choices: ["Crust", "Mantle", "Inner core"] },
      { question: "Which layer is made mainly of liquid iron and nickel?", choices: ["Outer core", "Inner core", "Crust"] },
      { question: "Which sequence goes from outside to inside?", choices: ["Crust, mantle, outer core, inner core", "Mantle, crust, inner core, outer core", "Inner core, outer core, crust, mantle"] },
    ],
    observe: "Separate the model, select each layer, and compare its position and composition.",
    overview: "Earth has four main layers. The thin solid crust is outside, the hot mantle lies beneath it, the outer core is liquid iron and nickel, and the inner core is solid because of immense pressure. Temperature and pressure generally increase toward Earth's center.",
  },
];

