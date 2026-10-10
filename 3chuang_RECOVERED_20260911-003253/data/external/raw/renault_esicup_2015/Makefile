clean:
	ls ./instancesA/*/* | grep -P ".*/instancesA/.*/(((rows|items|stacks|bins|layers).csv)|(logs_.*))" | xargs -d"\n" rm -rf
	ls ./instancesB/*/* | grep -P ".*/instancesB/.*/(((rows|items|stacks|bins|layers).csv)|(logs_.*))" | xargs -d"\n" rm -rf
	ls ./instancesX/*/* | grep -P ".*/instancesX/.*/(((rows|items|stacks|bins|layers).csv)|(logs_.*))" | xargs -d"\n" rm -rf
	rm -rf ./instancesA/checker_logs.txt
	rm -rf ./instancesB/checker_logs.txt
	rm -rf ./instancesX/checker_logs.txt
