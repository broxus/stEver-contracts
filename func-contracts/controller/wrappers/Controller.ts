import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type ControllerConfig = {};

export function controllerConfigToCell(config: ControllerConfig): Cell {
    return beginCell().endCell();
}

export class Controller implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Controller(address);
    }

    static createFromConfig(config: ControllerConfig, code: Cell, workchain = 0) {
        const data = controllerConfigToCell(config);
        const init = { code, data };
        return new Controller(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
