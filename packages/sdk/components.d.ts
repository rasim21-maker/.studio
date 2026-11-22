export interface ComponentBindings {version:1;components:{id:string;page:string;section:string;sourceFile:string;exportName:string;props:Record<string,string>}[]}
export function validateComponentBindings(document:any,manifest:unknown):ComponentBindings;
export function componentProps(document:any,manifest:ComponentBindings,id:string,locale?:string):Readonly<Record<string,string|number|boolean>>;
