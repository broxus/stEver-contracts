import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Controller } from '../wrappers/Controller';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Controller', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Controller');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let controller: SandboxContract<Controller>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        controller = blockchain.openContract(Controller.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await controller.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: controller.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and controller are ready to use
    });
});
