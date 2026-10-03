export const storageKey='ilmira-mini-demo-v1';
export function initialState(){return {paid:false,lessonRead:false};}
export function safeState(value){return {paid:value?.paid===true,lessonRead:value?.lessonRead===true};}
export function balance(state){return 2500+(state.paid?1000:0);}
export function referralUrl(origin,path='/mini-demo/'){return new URL(`${path}?ref=demo`,origin).href;}
