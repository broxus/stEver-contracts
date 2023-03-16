# StEver

StEver is a staking platform that aggregates real network validators in one place. This platform
has the ability to automatically balance between validators.

### This project resolves problems:
1. Users shouldn't select a validator for them self
2. Users shouldn't freeze their money, after stake user will receive StEver tokens based on the current rate

 
## Deploy
```shell
npm i
```
```shell
SEED="{{seed phrase}}" \
MAIN_GIVER_KEY={{giver secret key}} \
npx locklift run --disable-build --network mainnet -s scripts/1_deploy-and-setup-stEverVault.ts
```
### Deploy params:
1. **MultiSig admin(owner) wallet address**: StEverVault owner
2. **TokeRoot address**: StEver token root address
3. **Governance PUBLIC key**: bot public key
4. **StEverVault deploy value (nano ever), min 100 ever**
5. **GainFee (nano ever), min 1 ever**: StEverVault will take gainFee from each strategy report to maintain the required gas level **(1 ever is recommended)**
6. **StEver platform fee (0..1000), 1% == 10**: This fee will aggregate (as a platform fee) for future withdrawal to the admin

## Get upgrade code

```shell
npx locklift run --disable-build --network mainnet -s scripts/2_fix_upgrade.ts
```
## Change log
### [v2]
#### Fixes

### [v3] - Cluster
This update provides validators the possibility to control their strategies for themselves
(in the previous version only `stEverOwner` could add and remove strategies from `StEverVault`)
#### Added
- Cluster entity was added to the StEverVault, now actions like deploy, add and delete strategy only allowed by the
  `Cluster` contract. Cluster can be created only by the `stEverOwner`. Each cluster includes constraints such as
  `maxStrategiesCount` and `assurance`.
  - `maxStrategiesCount` - maximal strategy count that can be created by the `Cluster`
  - `assurance` - Assurance that should be provided by the `clusterOwner` to his `Cluster`. `assurance` is `StEver` value,
    so the `clusterOwner` should make a `StEver` token transfer to the `Cluster` address
  
Now interaction with strategies looks like this:
1. We need to create a `Cluster`, this method can be called by `stEverOnwer` only
- Other operations should be done by `clusterOwner`
2. Deploy strategies via `Cluster.deployStrategies(_dePools=deppolssAddress[])`
3. Attach strategies to the StEver `Cluster.addStrategies(_strategies=strategiesAddresses[])`
- Remove strategies
1. `Cluster.removeStrategies(_strategies=strategiesAddresses[])`




