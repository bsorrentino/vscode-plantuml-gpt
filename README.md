# vscode-plantuml-gpt

vscode extension that allows to create/update PlantUML diagram using GPT. Thought to work jointly with [PlantUML extension]

## Features

* Show GPT panel when a plantuml editor is activated.
* Uses current diagram as input context for GPT processing, this allows to perform intelligent update
* Keeps track of submitted prompts with possibility to persist them

### Create a diagram from Image

From version `0.4.x` there is the possibility to generate a PlantUML script from an image  either in the project workspace or from an URL.  In the video below you can see how generate a PlantUML diagram from an image into workspace:

![create diagram from image](images/create-diagram-from-image.gif)

### Create a diagram using NLP

Describe best as you can the diagram that you'd like to create and GPT will generate it. In the video below you can see the generated diagram using prompt:

>```
>Write sequence diagram that represent an invocation to a "microservice" that need authentication based upon the OAuth2 standard flow 
>```

![create diagram](images/create-diagram-XL.gif)

### Update a diagram using NLP

You can also give to GPT an instruction to update current diagram

![update diagram](images/update-diagram-XL.gif)

## Requirements

1. Need to have an extension able to define a PlantUML editor (ie. define `plantuml` document type). Take a look to [PlantUML extension]

## Extension Settings

You need to configure an [OpenAI] token to enable extension

<!--
For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.
-->

<!--

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.
-->


## Release Notes

### 0.4.4

* Externalize model names in configuration. fix issues [#6] and [#7]

### 0.4.3

* Improve error message. fix issue [#4](https://github.com/bsorrentino/vscode-plantuml-gpt/issues/4)  

### 0.4.2

* Update Readme with **Image to Diagram video**.

### 0.4.1

* Fix the `0.4.0` release.

### 0.4.0

* Add AI Multi-Modality using [GPT-4 Vision API][gpt4v] to transform image representing diagram in plantuml script.
    * Transform images from URL (online images)
    * Transform images in the current VSCode Workspace  

### 0.3.0

* Move out from [deprecated OpenAI API Model](https://platform.openai.com/docs/deprecations/edit-models-endpoint)  moving from **Edit Model** to **Chat Completion**

### 0.2.0

* show the tokens usage

### 0.1.0 

* Show GPT panel when a plantuml editor is activated.
* Uses current diagram as input context for GPT processing, this allows to perform intelligent update
* Keeps track of submitted prompts with possibility to persist them


---

[PlantUML extension]: https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml
[OpenAI]: https://openai.com
[gpt4v]: https://help.openai.com/en/articles/8555496-gpt-4-vision-api