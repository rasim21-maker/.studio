declare const validate: { (value:unknown):boolean; errors?:{instancePath:string;keyword:string;params:unknown}[]|null };
export default validate;
