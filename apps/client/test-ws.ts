// @ts-ignore
import ws from 'ws';
console.log("ws is a function?", typeof ws === 'function');
console.log("ws.default is a function?", typeof (ws as any).default === 'function');
