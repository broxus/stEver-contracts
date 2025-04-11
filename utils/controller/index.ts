import { Address } from "everscale-inpage-provider";
import { Contract, toNano } from "locklift";
import fs from "node:fs";
import path from "node:path";
import { convertEverGas } from "../index";

export const CONTROLLER_ABI = {
  "ABI version": 2,
  version: "2.2",
  header: [],
  functions: [
    {
      name: "controller_newStake",
      id: "0x4e73744b",
      inputs: [
        { name: "queryId", type: "uint64" },
        { name: "valueToStake", type: "token" },
        { name: "validatorPubKey", type: "uint256" },
        { name: "stakeAt", type: "uint32" },
        { name: "maxFactor", type: "uint32" },
        { name: "adnlAddr", type: "uint256" },
        { name: "signature1", type: "uint256" },
        { name: "signature2", type: "uint256" },
      ],
      outputs: [],
    },
    {
      name: "recoverStake",
      id: "0xeb373a05",
      inputs: [{ name: "queryId", type: "uint64" }],
      outputs: [],
    },
    {
      name: "updateValidatorHashTEST",
      id: "0xf0fd2210",
      inputs: [{ name: "queryId", type: "uint64" }],
      outputs: [],
    },
    {
      name: "updateValidatorHash",
      id: "0xf0fd2250",
      inputs: [{ name: "queryId", type: "uint64" }],
      outputs: [],
    },
    {
      name: "sendRequestLoan",
      id: "0x6335b11a",
      inputs: [
        { name: "queryId", type: "uint64" },
        { name: "minLoan", type: "token" },
        { name: "maxLoan", type: "token" },
        { name: "maxInterest", type: "uint32" },
      ],
      outputs: [],
    },
    {
      name: "sendRequestLoanTEST",
      id: "0x6335b12a",
      inputs: [
        { name: "queryId", type: "uint64" },
        { name: "minLoan", type: "token" },
        { name: "maxLoan", type: "token" },
        { name: "maxInterest", type: "uint32" },
      ],
      outputs: [],
    },
    {
      name: "sendRequestLoan",
      id: "0x6335b11a",
      inputs: [
        { name: "queryId", type: "uint64" },
        { name: "minLoan", type: "token" },
        { name: "maxLoan", type: "token" },
        { name: "maxInterest", type: "uint32" },
      ],
      outputs: [],
    },
  ],
  events: [],
  fields: [
    {
      name: "state",
      type: "uint8",
    },
    {
      name: "halted",
      type: "bool",
    },
    {
      name: "approved",
      type: "bool",
    },
    {
      name: "stake_amount_sent",
      type: "token",
    },
    {
      name: "stake_at",
      type: "uint32",
    },
    {
      name: "saved_validator_set_hash",
      type: "uint256",
    },
    {
      name: "validator_set_changes_count",
      type: "uint8",
    },
    {
      name: "validator_set_change_time",
      type: "uint32",
    },
    {
      name: "stake_held_for",
      type: "uint32",
    },
    {
      name: "borrowed_amount",
      type: "token",
    },
    {
      name: "borrowing_time",
      type: "uint32",
    },
    {
      name: "sudoer",
      type: "address",
    },
    {
      name: "sudoer_set_at",
      type: "uint32",
    },
    {
      name: "max_expected_interest",
      type: "uint32",
    },

    {
      name: "staticData",
      type: "cell",
    },
  ],
} as const;

export class Controller {
  controllerContract: Contract<typeof CONTROLLER_ABI>;
  constructor(address: Address, private readonly owner: Address) {
    this.controllerContract = new locklift.provider.Contract(CONTROLLER_ABI, address);
  }

  getFields = async () => {
    const allFields = await this.controllerContract.getFields({ allowPartial: true }).then(res => res.fields);

    const staticData = await locklift.provider
      .unpackFromCell({
        abiVersion: "2.2",
        structure: [
          { name: "controllerId", type: "uint32" },
          { name: "validator", type: "address" },
          { name: "pool", type: "address" },
          { name: "governor", type: "address" },
          { name: "restAddresses", type: "cell" },
        ] as const,
        allowPartial: true,
        boc: allFields!.staticData,
      })
      .then(res => res.data);

    const restAddresses = await locklift.provider
      .unpackFromCell({
        abiVersion: "2.2",
        structure: [
          { name: "approver", type: "address" },
          { name: "halter", type: "address" },
          { name: "elector", type: "address" },
        ] as const,
        allowPartial: true,
        boc: staticData!.restAddresses,
      })
      .then(res => res.data);
    return {
      ...allFields,
      staticData: {
        ...staticData,
        restAddresses,
      },
    };
  };
  static get code() {
    return Buffer.from(
      JSON.parse(fs.readFileSync(path.join("/projects/broxus/ton/flushpool/build/Controller.compiled.json"), "utf-8"))
        .hex,
      "hex",
    ).toString("base64");
  }
  newStake = async ({
    valueToStake,
    stakeAt,
    queryId,
    adnlAddr,
    maxFactor,
    validatorPubKey,
  }: {
    queryId: number;
    valueToStake: string;
    validatorPubKey: string;
    stakeAt: number;
    maxFactor: number;
    adnlAddr: string;
  }) => {
    return locklift.tracing.trace(
      this.controllerContract.methods
        .controller_newStake({
          queryId: "1741794036556",
          valueToStake: "50000000000000" as unknown as any,
          validatorPubKey: "30318225572055994315379833926926798418664003097705292461024222313172906188525",
          stakeAt: "1741794344",
          maxFactor: "196608",
          adnlAddr: "30318225572055994315379833926926798418664003097705292461024222313172906188525",
          signature1: "31346139131171700078104425958100444279781703857159042667941931448467032758752",
          signature2: "96487562042140136021777347316754177054674011024658950460530751154669444814603",
        })
        .send({
          from: this.owner,
          amount: toNano(convertEverGas(1.05)),
        }),
    );
  };

  recoverStake = async ({ queryId }: { queryId: number }) => {
    return locklift.tracing.trace(
      this.controllerContract.methods
        .recoverStake({ queryId })
        .send({ from: this.owner, amount: toNano(convertEverGas(1.03)) }),
    );
  };

  updateValidatorHashTest = async ({ queryId }: { queryId: number }) => {
    return locklift.tracing.trace(
      this.controllerContract.methods
        .updateValidatorHashTEST({ queryId })
        .send({ from: this.owner, amount: toNano(convertEverGas(1.03)) }),
    );
  };

  updateValidatorHashMultipleTimes = async (count = 2) => {
    for (let i = 0; i < count; i++) {
      await this.updateValidatorHashTest({ queryId: i });
    }
  };

  sendRequestLoan = async ({
    queryId,
    maxLoan,
    minLoan,
    maxInterest,
  }: {
    queryId: number;
    maxLoan: string;
    minLoan: string;
    maxInterest: string;
  }) => {
    return locklift.tracing.trace(
      this.controllerContract.methods
        .sendRequestLoanTEST({
          queryId,
          //@ts-ignore
          maxLoan,
          //@ts-ignore
          minLoan,
          maxInterest,
        })
        .send({
          from: this.owner,
          amount: toNano(convertEverGas(1.03)),
        }),
      {
        allowedCodes: {
          compute: [60],
        },
        raise: false,
      },
    );
  };

  runFullCycle = async ({
    queryId,
    valueToStake,
    stakeAt,
    adnlAddr,
    maxFactor,
    validatorPubKey,
  }: {
    queryId: number;
    valueToStake: string;
    stakeAt: number;
    adnlAddr: string;
    maxFactor: number;
    validatorPubKey: string;
  }) => {
    const { traceTree: newStakeTraceTree } = await this.newStake({
      queryId,
      valueToStake,
      stakeAt,
      adnlAddr,
      maxFactor,
      validatorPubKey,
    });
    await this.updateValidatorHashMultipleTimes();
    const { traceTree: recoverStakeTraceTree } = await this.recoverStake({ queryId });

    return {
      newStakeTraceTree,
      recoverStakeTraceTree,
    };
  };
}
