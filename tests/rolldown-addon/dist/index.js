import Component from "@glimmer/component";
import { setComponentTemplate } from "@ember/component";
import { createTemplateFactory } from "@ember/template-factory";

//#region ./components/super-table.ts
var SuperTable = class extends Component {
	get label() {
		return "label";
	}
	static {
		setComponentTemplate(createTemplateFactory({
			"id": null,
			"block": "[[[11,\"table\"],[17,1],[16,\"aria-label\",[30,0,[\"label\"]]],[12],[1,\"\\n\"],[41,[48,[30,5]],[[[1,\"    \"],[10,\"thead\"],[12],[1,\"\\n      \"],[10,\"tr\"],[12],[18,5,null],[13],[1,\"\\n    \"],[13],[1,\"\\n\"]],[]],null],[1,\"\\n  \"],[10,\"tbody\"],[12],[1,\"\\n\"],[42,[28,[31,4],[[28,[31,4],[[30,2]],null]],null],null,[[[1,\"      \"],[10,\"tr\"],[12],[18,6,[[30,3],[30,4]]],[13],[1,\"\\n\"]],[3,4]],null],[1,\"  \"],[13],[1,\"\\n\"],[13]],[\"&attrs\",\"@items\",\"item\",\"index\",\"&header\",\"&row\"],[\"if\",\"has-block\",\"yield\",\"each\",\"-track-array\"]]",
			"moduleName": "(unknown template module)",
			"isStrictMode": true
		}), this);
	}
};

//#endregion
//#region ./invoker.ts
const invoker = "keyboard";

//#endregion
export { SuperTable, invoker };