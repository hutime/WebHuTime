setlocal
cd /d %~dp0
set source=.\
set target=..\release\

copy /y %source%HuTimeRoot.js %target%HuTime.js
type %source%Common.js >> %target%HuTime.js
type %source%JSON.js >> %target%HuTime.js
type %source%Container.js >> %target%HuTime.js
type %source%Position.js >> %target%HuTime.js
type %source%OLObject.js >> %target%HuTime.js
type %source%Slider.js >> %target%HuTime.js
type %source%TickScale.js >> %target%HuTime.js
type %source%CalendarScale.js >> %target%HuTime.js
type %source%TRange.js >> %target%HuTime.js
type %source%Data.js >> %target%HuTime.js
type %source%RecordLayer.js >> %target%HuTime.js
type %source%TLineLayer.js >> %target%HuTime.js
type %source%ChartLayer.js >> %target%HuTime.js
type %source%RecordStream.js >> %target%HuTime.js

endlocal
