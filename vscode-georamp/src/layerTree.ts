/** Session layer tree. First sibling is drawn on top. */
export class LayerTree {
  nodes: Array<{id:string; name:string; kind:'layer'|'group'; parent:string|null; visible:boolean; opacity:number; expanded:boolean}> = [];
  add(id:string, name:string, kind:'layer'|'group' = 'layer', parent:string|null = null): void {
    if (this.nodes.some(n => n.id === id)) return;
    this.nodes.unshift({id,name,kind,parent,visible:true,opacity:1,expanded:true});
  }
  move(id:string, parent:string|null, before?:string): boolean {
    const node = this.nodes.find(n => n.id === id);
    if (!node || parent === id) return false;
    let ancestor = parent;
    const visited = new Set<string>();
    while (ancestor) {
      if (ancestor === id || visited.has(ancestor)) return false;
      visited.add(ancestor);
      const group = this.nodes.find(n => n.id === ancestor);
      if (!group || group.kind !== 'group') return false;
      ancestor = group.parent;
    }
    node.parent = parent;
    this.nodes = this.nodes.filter(n => n.id !== id);
    const index = this.nodes.findIndex(n => n.id === before && n.parent === parent);
    this.nodes.splice(index < 0 ? this.nodes.length : index, 0, node);
    return true;
  }
  remove(id:string): void {
    const node = this.nodes.find(n => n.id === id);
    if (!node) return;
    this.nodes.forEach(n => { if (n.parent === id) n.parent = node.parent; });
    this.nodes = this.nodes.filter(n => n.id !== id);
  }
  layers(parent:string|null = null, visible = true, opacity = 1): Array<{id:string;visible:boolean;opacity:number}> {
    return this.nodes.filter(n => n.parent === parent).flatMap(n => n.kind === 'group'
      ? this.layers(n.id, visible && n.visible, opacity*n.opacity)
      : [{id:n.id,visible:visible && n.visible,opacity:opacity*n.opacity}]);
  }
}
