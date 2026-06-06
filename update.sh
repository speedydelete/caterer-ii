pushd lifeweb
git pull
./build
popd
git pull
./node_modules/.bin/tsc -b