## Declare new alias

### instruction
```
when write : item "name" then translate in :  rectangle name as "name"
```

### usage
```
add item "pippo"
```

### result 
```plantuml
rectangle pippo as "pippo"
```



### Prompt
```
In this sequence diagram consider :

the Flow keyword is translated in : rectangle "Flow\n<$powerautomate,scale=.4,color=blue>" as Flow
the  CanvasApp keyword is translated in: rectangle "Canvas App\n<$powerapps,scale=.4,color=purple>" as CanvasApp

In the diagram

let CanvasApp calls Flow : Submit request
```
### Result 
```plantuml
rectangle "Flow\n<$powerautomate,scale=.4,color=blue>" as Flow
rectangle "Canvas App\n   <$powerapps,scale=.4,color=purple>" as Canvas

Canvas -> Flow : Submit request
```