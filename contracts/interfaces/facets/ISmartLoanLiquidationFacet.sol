pragma solidity ^0.8.17;

interface ISmartLoanLiquidationFacet {
  function _getLTV (  ) external returns ( uint256 ltv );
  function getMaxLiquidationBonus (  ) external view returns ( uint256 );
  function getMaxLtv (  ) external view returns ( uint256 );
  function getMinLtvAfterLiquidation (  ) external view returns ( uint256 );
  function getPrice ( bytes32 symbol ) external view returns ( uint256 price );
  function getPrices ( bytes32[] memory symbols ) external view returns ( uint256[] memory prices );
  function liquidateLoan ( bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonus) external;
  function unsafeLiquidateLoan ( bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonus) external;
  function whitelistLiquidators(address[] memory _liquidators) external;
  function delistLiquidators(address[] memory _liquidators) external;
  function isLiquidatorWhitelisted(address _liquidator) view external returns(bool);

  event Liquidated(address indexed liquidator, bool indexed healing, uint256 initialTotal, uint256 initialDebt, uint256 repayAmount, uint256 bonusInUSD, uint256 health, uint256 timestamp);
  event LiquidationRepay(address indexed liquidator, bytes32 indexed asset, uint256 amount, uint256 timestamp);
  event LiquidationTransfer(address indexed liquidator, bytes32 indexed asset, uint256 amount, uint256 timestamp);
  event LiquidatorWhitelisted(address indexed liquidator, address performer, uint256 timestamp);
  event LiquidatorDelisted(address indexed liquidator, address performer, uint256 timestamp);
}
