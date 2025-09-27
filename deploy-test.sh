#!/bin/bash
MAIN_TARGET="main"

# Function to build and deploy a test page for the Stargate Web Client example
# $1: prefix - the prefix for the deployment, "stargate/v1/$MAIN_TARGET" 
# $2: version - the version of the deployment (branch name or npm version)
# $3: deploying_branch - 1 if we are deploying a branch, 0 if we are deploying a version
build_and_deploy() {
    prefix=$1
    version=$2
    deploying_branch=$3

    echo "Building Stargate Web Client example version $version with prefix $prefix"
    vite build --base=$prefix/$version/
    if [ $? -ne 0 ]; then
        echo "Build failed."
        exit 1
    fi

    if [ -z "$APPBUILDER_BUCKET" ]; then
        echo "APPBUILDER_BUCKET environment variable is not set."
        exit 1
    fi

    cachecontrol="public, max-age=31536000, immutable"
    # if we are deploying a branch, we need to change the cache control, compared to a version
    if [ $deploying_branch -eq 1 ]; then
        cachecontrol="public, max-age=0, s-maxage=86400"
    fi

    echo "Deploying to version $version with prefix $prefix to bucket $APPBUILDER_BUCKET"

    # depending on the prefix, we need to deploy to different locations
    if [ $prefix == "stargate/v1/$MAIN_TARGET" ]; then
        aws s3 sync ./dist s3://$APPBUILDER_BUCKET/appbuilder/$prefix/$version/ --region us-east-1 --cache-control "$cachecontrol"
        touch empty
        aws s3 cp empty s3://$APPBUILDER_BUCKET/appbuilder/$prefix/$version --region us-east-1 \
            --website-redirect https://appbuilder.shapediver.com/$prefix/$version/ --cache-control "$cachecontrol"
        aws s3 cp empty s3://$APPBUILDER_BUCKET/appbuilder/$prefix/.invalidate --region us-east-1 \
            --cache-control "$cachecontrol"
        rm empty
    else
        echo "Unsupported prefix for deployment."
        exit 1
    fi
}

# load environment variables from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | sed 's/#.*//' | sed 's/^ *//;s/ *$//' | xargs)
fi

# where should we deploy?
prefix=$1
if [ -z "$prefix" ]; then
    echo "Please specify a prefix."
    exit 1
fi

# check for git changes
if [[ -n $(git status --porcelain) ]]; then
    echo "There are uncommitted changes."
    exit 1
fi

# Get the current branch
branch=$(git rev-parse --abbrev-ref HEAD)

# npm version
npm_version=$(node -p "require('./package.json').version")
echo "Current npm version: $npm_version"

deploying_branch=1

# If the branch is "development", "staging" or starts with "task/", we use the branch name as the version
if [ "$branch" == "development" ] || [ "$branch" == "staging" ]; then
    deploying_branch=1
    version=$branch
    
    # And we create a new tag with the name "WordPressPlugin@branch"
    git tag -fa "StargateWebClient@$branch" -m "Release of branch $branch"
    git push origin "StargateWebClient@$branch" --force
elif [[ $branch == task/* ]]; then
    deploying_branch=1
    # In this case we have to remove the "task/" prefix
    version=${branch#task/}
else 
    echo "Unsupported branch name."
    exit 1
fi

build_and_deploy $prefix $version $deploying_branch
