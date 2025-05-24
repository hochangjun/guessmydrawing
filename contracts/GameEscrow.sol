// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GameEscrow {
    struct Game {
        address owner;
        uint256 wagerAmount;
        uint256 totalDeposits;
        mapping(address => bool) hasDeposited;
        address[] players;
        bool isFinished;
        address winner;
    }
    
    mapping(string => Game) public games;
    
    event GameCreated(string gameId, address owner, uint256 wagerAmount);
    event PlayerDeposited(string gameId, address player, uint256 amount);
    event PrizeDistributed(string gameId, address winner, uint256 amount);
    
    modifier onlyGameOwner(string memory gameId) {
        require(games[gameId].owner == msg.sender, "Only game owner can call this");
        _;
    }
    
    modifier gameExists(string memory gameId) {
        require(games[gameId].owner != address(0), "Game does not exist");
        _;
    }
    
    modifier gameNotFinished(string memory gameId) {
        require(!games[gameId].isFinished, "Game is already finished");
        _;
    }
    
    function createGame(string memory gameId, uint256 wagerAmount) external {
        require(games[gameId].owner == address(0), "Game already exists");
        require(wagerAmount > 0, "Wager amount must be greater than 0");
        
        Game storage game = games[gameId];
        game.owner = msg.sender;
        game.wagerAmount = wagerAmount;
        game.totalDeposits = 0;
        game.isFinished = false;
        
        emit GameCreated(gameId, msg.sender, wagerAmount);
    }
    
    function depositWager(string memory gameId) external payable gameExists(gameId) gameNotFinished(gameId) {
        Game storage game = games[gameId];
        require(msg.value == game.wagerAmount, "Incorrect wager amount");
        require(!game.hasDeposited[msg.sender], "Player has already deposited");
        
        game.hasDeposited[msg.sender] = true;
        game.players.push(msg.sender);
        game.totalDeposits += msg.value;
        
        emit PlayerDeposited(gameId, msg.sender, msg.value);
    }
    
    function distributePrize(string memory gameId, address winner) external onlyGameOwner(gameId) gameExists(gameId) gameNotFinished(gameId) {
        Game storage game = games[gameId];
        require(game.hasDeposited[winner], "Winner must be a player who deposited");
        require(game.totalDeposits > 0, "No deposits to distribute");
        
        game.isFinished = true;
        game.winner = winner;
        
        uint256 prizeAmount = game.totalDeposits;
        game.totalDeposits = 0;
        
        (bool success, ) = winner.call{value: prizeAmount}("");
        require(success, "Prize transfer failed");
        
        emit PrizeDistributed(gameId, winner, prizeAmount);
    }
    
    function getGameInfo(string memory gameId) external view returns (
        address owner,
        uint256 wagerAmount,
        uint256 totalDeposits,
        uint256 playerCount,
        bool isFinished,
        address winner
    ) {
        Game storage game = games[gameId];
        return (
            game.owner,
            game.wagerAmount,
            game.totalDeposits,
            game.players.length,
            game.isFinished,
            game.winner
        );
    }
    
    function hasPlayerDeposited(string memory gameId, address player) external view returns (bool) {
        return games[gameId].hasDeposited[player];
    }
    
    function getGamePlayers(string memory gameId) external view returns (address[] memory) {
        return games[gameId].players;
    }
    
    // Emergency function to refund all players if game is stuck
    function emergencyRefund(string memory gameId) external onlyGameOwner(gameId) gameExists(gameId) gameNotFinished(gameId) {
        Game storage game = games[gameId];
        require(game.totalDeposits > 0, "No deposits to refund");
        
        uint256 refundAmount = game.wagerAmount;
        for (uint256 i = 0; i < game.players.length; i++) {
            address player = game.players[i];
            (bool success, ) = player.call{value: refundAmount}("");
            require(success, "Refund failed");
        }
        
        game.totalDeposits = 0;
        game.isFinished = true;
    }
} 