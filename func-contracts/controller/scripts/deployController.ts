import { toNano } from '@ton/core';
import { Controller } from '../wrappers/Controller';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const controller = provider.open(Controller.createFromConfig({}, await compile('Controller')));

    await controller.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(controller.address);

    // run methods on `controller`
}
