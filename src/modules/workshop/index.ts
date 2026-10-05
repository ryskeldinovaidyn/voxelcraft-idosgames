// @idosgames/mod-workshop — the Workshop: player & publisher content and licenses, for any game.
//
// Primary export is the module manifest; the React screen is exported too so a project can place it
// elsewhere (a modal, a mode of its own) after copying this into src/modules/.

export { workshopModule } from "./module";
export {
  makeWorkshopScreen,
  WorkshopApp,
  type WorkshopHost,
} from "./WorkshopApp";
