All scripts must be run from the project base directory!


##Upload NFTs to Arweave and generate list of metadata addresses

This script will **CLEAR** `uris.txt` file, try to upload **ALL FILES** (regardless the format or size)
 from `./images` directory to Arweave with metadata defined in `metadata.json`, and **ADD** arweave addresses of metadata
JSON files to `uris.txt`

    node ./tools/scripts/nft/arweave-upload


##Add available URIs to NFTAccess contract

This method will take all addresses from `uris.txt` file and add them to NFT Access contract.

Windows:

    node -r esm -e 'require("./tools/scripts/nft/nft").populateNftUris("NETWORK_NAME", "NFT_CONTRACT_NAME")'

MacOS:

    node -r esm -e "require('./tools/scripts/nft/nft').populateNftUris('NETWORK_NAME', 'NFT_CONTRACT_NAME')"




