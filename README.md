# StEver

StEver is a staking platform that aggregates real network validators in one place. This platform
has the ability to automatically balance between validators.

### This project resolves problems:
1. Users shouldn't select a validator for them self
2. Users shouldn't freeze their money, after stake user will receive StEver tokens based on the current rate

## Functional Description
### Roles
+ StEverVault
  - User - Permitted to deposit and withdraw from the StEverVault.
  Additionally, the user can invoke an emergency state if the
  Governance system becomes inactive.
  - Owner - Has the authority to create new Cluster accounts for
  validators, approve strategies, and oversee the upgradability
  of contracts.
  - Governance - Tasked with processing withdrawal requests for
  users. It also manages the rebalancing of deposits among
  Validator strategies.
+ StEverAccount
  - Vault - All functions inside the StEverAccount are executed by
  the StEverVault.
+ StEverCluster
  - ClusterOwner - Empowered to deploy new strategies and add these
  deployed strategies to the StEverVault.
  - StEverOwner - Has the authority to remove a Cluster from the
  system, with an option to penalize the validator. Can also set
  the assurance limit value.
  - Vault - Validates responses to contract actions, ensuring they
  originate from the StEverVault.
+ StrategyDePool
  - Vault - Ensures that function calls made to StrategyDePool are
  initiated by StEverVault.
  - DePool - Ensures that function calls made to StrategyDePool are
  initiated by DePool.
+ DepoolStrategyFactory
  - Owner - Granted the capability to introduce new StrategyDePool
  code and upgrade existing strategies to the latest code
### Actors
1. **StEverVault** - a contract that aggregates all validators and provides the ability to stake
2. **User** - a person who wants to stake his money
3. **StEverAccount** - a user account that represents user's withdrawal requests
4. **StEver** - a token that represents the user's stake in the StEverVault
5. **StEverGovernance** - a software that manage ever tokens between connected validators
6. **StEverStrategy** - an abstraction that represents a connector to `DePool` contract
7. **StEverCluster** - a contract that aggregates strategies owned by a validator

### Actors behavior
#### StEverVault
This is the main entry point for each user, owner, governance operations. It keeps all ever assets, and also it is the `StEver` token issuer.
Let's dig into the `StEverVault` functionality:
1. **Deposit** - `StEver.deposit` user can deposit his ever tokens to the `StEverVault` and receive `StEver` tokens in return
2. **Withdraw** - `StEver.onAcceptTokensTransfer` user can withdraw his ever tokens from the `StEverVault` by sending `StEver` tokens to the `StEverVault`.
After it inside the user's **StEverAccount** will be created new withdrawal request (withdraw request can also be canceled by the user).
When `withfrawHoldTime` will be passed, and `StEverGovernance` will process this request, user will receive his `ever` tokens + reward back
#### StEverCluster
If the validator wants to participate to StEver project he should get in touch with StEver admins. After some checks,
if a validator pass our checks we will create a `StEverCluster` contract for him.

**Integrate validator functionality**
1. Admin will call `StEver.createCluster`, after this call new cluster will be added to `clusterPools` mapping.
Then cluster address will be provided to validator
2. Validator going to deploy his `DePool` contracts and call `StEverCluster.deployStrategies` with `DePool` addresses
3. Each cluster has its own constrains such as `maxStrategiesCount` and `assurance`. `maxStrategiesCount` is a maximal
   strategy count that can be created by the `Cluster`. `assurance` is Assurance that should be provided by the
   `clusterOwner` to his `Cluster`. `assurance` is `StEver` value, so the `clusterOwner` should make a `StEver` token
   transfer to the `Cluster` address
4. When all constraints are satisfied, the validator can obtain strategies addresses, and call `StEverCluster.addStrategies` with strategies addresses.
After its strategies will be added to the `StEverVault` and will be available for staking

#### StEverGovernance
This is software that has access to re-balance ever tokens between connected strategies, and also it manages withdrawals for users.

**Re-balance functionality**
1. `StEverVault.depositToStrategies`
2. `StEverVault.processWithdrawFromStrategies`

**Withdraw request satisfaction**
1. `StEverVault.processSendToUsers`
 
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

### [V4]
With this update we improve `withfrawHoldTime` for each user. This is anti-abuse mechanism
that allows to withdraw only after `withfrawHoldTime` from the withdrawal request. 
#### Added
- Filed `withfrawHoldTime` - time that should be passed from the withdrawal request to the withdrawal itself
- Each withdrawal request has its own `unlockTime` that is calculated as `now + withfrawHoldTime`

### [V5]
This update provide `reduction factor` for rewards. This factor is used to reduce growing of ever/stEver ratio.
And now users are obtaining their rewards immediately after the stake was made (each second rate are growing).
Instead of obtaining rewards immediately after strategy report.






