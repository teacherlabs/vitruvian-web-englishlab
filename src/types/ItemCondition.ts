import {ItemAnimation} from "./ItemAnimation";
import {ItemLayer} from "./ItemLayer";

export class ItemCondition {
    layer:ItemLayer
    condition: string
    path: string
    animations: {[key:string]: ItemAnimation} = {}

    constructor(layer:ItemLayer, condition:string, path:string, animations:{[key:string]: ItemAnimation}) {
        this.layer = layer
        this.condition = condition
        this.path = path
        this.animations = animations
    }

    getPath() {
        if (!this.path || this.path === '.') {
            return this.layer.getPath()
        }

        return `${this.layer.getPath()}/${this.path}`.replace('/./', '/')
    }

    async load() {
        return Promise.all(
            Object.values(this.animations)
                .filter(() => this.layer.item.collection.isSelected(this.condition))
                .map((animation:ItemAnimation) => animation.load())
        );
    }

    async colorize() {
        return Promise.all(
            Object.values(this.animations)
                .filter(() => this.layer.item.collection.isSelected(this.condition))
                .map((animation:ItemAnimation) => animation.colorize())
        );
    }
}
