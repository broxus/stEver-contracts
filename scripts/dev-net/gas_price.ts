import { Address, ProviderRpcClient } from "everscale-inpage-provider";
import { EverscaleStandaloneClient } from "everscale-standalone-client/nodejs";
import moment from "moment";

const ever = locklift.provider;

export const start = async () => {
  // await ever.ensureInitialized();

  const config = new ever.Contract(
    CONFIG_ABI,
    new Address("-1:5555555555555555555555555555555555555555555555555555555555555555"),
  );

  const { fields } = await config.getFields({ allowPartial: true });
  if (fields == null) {
    throw new Error("Config contract state not found");
  }

  const { boc: nonEmptyMap } = await ever.packIntoCell({
    abiVersion: "2.2",
    structure: [
      { name: "flag", type: "bool" },
      { name: "root", type: "cell" },
    ] as const,
    data: {
      flag: true,
      root: fields.paramsRoot,
    },
  });

  const {
    data: { params: rawParams },
  } = await ever.unpackFromCell({
    abiVersion: "2.2",
    structure: [{ name: "params", type: "map(uint32,cell)" }] as const,
    allowPartial: true,
    boc: nonEmptyMap,
  });
  const params = new Map<number, string>();
  for (const [id, value] of rawParams) {
    params.set(parseInt(id), value);
  }

  const {
    data: { value: mcPrices },
  } = await ever.unpackFromCell({
    abiVersion: "2.2",
    structure: PRICES_PARAM_ABI,
    allowPartial: true,
    boc: params.get(20)!,
  });

  const {
    data: { value: scPrices },
  } = await ever.unpackFromCell({
    abiVersion: "2.2",
    structure: PRICES_PARAM_ABI,
    allowPartial: true,
    boc: params.get(21)!,
  });

  // console.log(scPrices);

  const {
    data: { value: validatorConfig },
  } = await ever.unpackFromCell({
    abiVersion: "2.2",
    structure: VALIDATOR_CONFIG_ABI_15,
    allowPartial: true,
    boc: params.get(15)!,
  });

  console.log(`validatorConfig ${JSON.stringify(validatorConfig, null, 2)}`);

  const {
    data: { value: curValidatorConfig },
  } = await ever.unpackFromCell({
    abiVersion: "2.2",
    structure: CUR_VALIDATOR_CONFIG_ABI_34,
    allowPartial: true,
    boc: params.get(34)!,
  });

  console.log(`curValidatorConfig ${JSON.stringify(curValidatorConfig, null, 2)}`);

  // throw_unless(error::too_early_loan_request, now() > utime_until - elections_start_before); ;; elections started
  const startElectionTimeOrig = moment.unix(
    Number(curValidatorConfig.utime_until) - Number(validatorConfig.elections_start_before),
  );

  const startElectionTimeUpdated = moment.unix(
    startElectionTimeOrig.unix() + Number(validatorConfig.stake_held_for) / 2,
  );
  // throw_unless(error::too_late_loan_request, now() < utime_until - elections_end_before);   ;; elections not yet closed
  const endElectionTime = moment.unix(
    Number(curValidatorConfig.utime_until) - Number(validatorConfig.elections_end_before),
  );

  const now = moment();

  console.log(`startElectionTime ${startElectionTimeOrig.format("YYYY-MM-DD HH:mm:ss")}`);
  console.log(`startElectionTimeUpdated ${startElectionTimeUpdated.format("YYYY-MM-DD HH:mm:ss")}`);

  console.log(`endElectionTime ${endElectionTime.format("YYYY-MM-DD HH:mm:ss")}`);
  console.log(`now ${now.format("YYYY-MM-DD HH:mm:ss")}`);
};

const CONFIG_ABI = {
  "ABI version": 2,
  version: "2.2",
  header: [],
  functions: [],
  events: [],
  fields: [
    {
      name: "paramsRoot",
      type: "cell",
    },
  ],
} as const;

const PRICES_PARAM_ABI = [
  {
    name: "value",
    type: "tuple",
    components: [
      // Flat tag
      { name: "tag1", type: "uint8" },
      // The price of gas unit.
      { name: "gasPrice", type: "uint64" },
      // The maximum amount of gas available for a compute phase of an ordinary transaction.
      { name: "gasLimit", type: "uint64" },
      // Ext tag
      { name: "tag2", type: "uint8" },
      // The maximum amount of gas available for a compute phase of a special transaction.
      { name: "specialGasLimit", type: "uint64" },
      // The maximum amount of gas available before `ACCEPT`.
      { name: "gasCredit", type: "uint64" },
      // The maximum amount of gas units per block.
      { name: "blockGasLimit", type: "uint64" },
      // Amount of debt (in tokens) after which the account will be frozen.
      { name: "freezeDueLimit", type: "uint64" },
      // Amount of debt (in tokens) after which the contract will be deleted.
      { name: "deleteDueLimit", type: "uint64" },
      // Size of the first portion of gas with different price.
      { name: "flatGasLimit", type: "uint64" },
      // The gas price for the first portion determinted by flatGasLimit
      { name: "flatGasPrice", type: "uint64" },
    ],
  },
] as const;
const VALIDATOR_CONFIG_ABI_15 = [
  {
    name: "value",
    type: "tuple",
    components: [
      // Flat validators_elected_for
      { name: "validators_elected_for", type: "uint32" },
      // elections_start_before.
      { name: "elections_start_before", type: "uint32" },
      // elections_end_before.
      { name: "elections_end_before", type: "uint32" },
      // _stake_held_for
      { name: "stake_held_for", type: "uint32" },
    ],
  },
] as const;
const CUR_VALIDATOR_CONFIG_ABI_34 = [
  {
    name: "value",
    type: "tuple",
    components: [
      // tag
      { name: "tag", type: "uint8" },
      // utime_since.
      { name: "utime_since", type: "uint32" },
      // utime_until.
      { name: "utime_until", type: "uint32" },
    ],
  },
] as const;

const main = async () => {
  while (true) {
    try {
      await start();
    } catch (err) {
      console.error(err);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
};

main();
