import path from 'node:path';
import {createStaticDeployAgent} from '../src/v2/static-deploy-agent.ts';
const {STUDIO_DEPLOY_DIRECTORY,STUDIO_DEPLOY_TOKEN,STUDIO_DEPLOY_INSTANCE,STUDIO_DEPLOY_ORIGIN}=process.env;
if(!STUDIO_DEPLOY_DIRECTORY||!STUDIO_DEPLOY_TOKEN||!STUDIO_DEPLOY_INSTANCE||!STUDIO_DEPLOY_ORIGIN)throw Error('Configure STUDIO_DEPLOY_DIRECTORY, STUDIO_DEPLOY_TOKEN, STUDIO_DEPLOY_INSTANCE and STUDIO_DEPLOY_ORIGIN.');
const port=Number(process.env.STUDIO_DEPLOY_PORT||4392);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
const agent=await createStaticDeployAgent({directory:path.resolve(STUDIO_DEPLOY_DIRECTORY),token:STUDIO_DEPLOY_TOKEN,instanceId:STUDIO_DEPLOY_INSTANCE,publicUrl:STUDIO_DEPLOY_ORIGIN});
agent.server.listen(port,'127.0.0.1',()=>console.log('Static deployment agent listening on loopback port '+port+'. TLS reverse proxy required.'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void agent.close().then(()=>process.exit(0));});
