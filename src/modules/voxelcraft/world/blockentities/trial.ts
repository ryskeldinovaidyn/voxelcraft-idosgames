// Спавнер испытаний — блочная сущность: состояние машины systems/TrialSpawner (шаги делает Game).
import { newTrialState } from "../../systems/TrialSpawner";
import { registerBlockEntity } from "../BlockEntities";

registerBlockEntity("trial_spawner", { create: () => newTrialState() });
