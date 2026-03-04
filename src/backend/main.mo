import Map "mo:core/Map";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  type Timestamp = Time.Time;
  type DayOfWeek = Nat;
  type RoutineId = Nat;
  type LogId = Nat;

  type ReminderOffset = {
    value : Nat;
    unit : Text;
  };

  type Routine = {
    id : RoutineId;
    name : Text;
    description : Text;
    scheduledTime : Text;
    repeatDays : [DayOfWeek];
    createdAt : Timestamp;
    reminderEnabled : Bool;
    reminderOffset : ReminderOffset;
  };

  type RoutineUpdate = {
    name : ?Text;
    description : ?Text;
    scheduledTime : ?Text;
    repeatDays : ?[DayOfWeek];
    reminderEnabled : ?Bool;
    reminderOffset : ?ReminderOffset;
  };

  type RoutineLog = {
    id : LogId;
    routineId : RoutineId;
    date : Text;
    status : Text;
    loggedAt : Timestamp;
  };

  type DailyRoutineStatus = {
    routine : Routine;
    status : ?Text;
  };

  public type UserProfile = {
    name : Text;
  };

  var nextRoutineId : RoutineId = 1;
  var nextLogId : LogId = 1;

  let routines = Map.empty<Principal, Map.Map<RoutineId, Routine>>();
  let routineLogs = Map.empty<Principal, Map.Map<LogId, RoutineLog>>();

  // User Management
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  func getUserRoutines(caller : Principal) : Map.Map<RoutineId, Routine> {
    if (not routines.containsKey(caller)) {
      let newMap = Map.empty<RoutineId, Routine>();
      routines.add(caller, newMap);
      newMap;
    } else {
      switch (routines.get(caller)) {
        case (null) { Runtime.trap("Failed to get user routines") };
        case (?map) { map };
      };
    };
  };

  func getUserRoutineLogs(caller : Principal) : Map.Map<LogId, RoutineLog> {
    switch (routineLogs.get(caller)) {
      case (null) { Map.empty<LogId, RoutineLog>() };
      case (?map) { map };
    };
  };

  // Routine Functions
  public shared ({ caller }) func createRoutine(
    name : Text,
    description : Text,
    scheduledTime : Text,
    repeatDays : [DayOfWeek],
    reminderEnabled : Bool,
    reminderOffset : ReminderOffset,
  ) : async RoutineId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create routines");
    };

    let routine : Routine = {
      id = nextRoutineId;
      name;
      description;
      scheduledTime;
      repeatDays;
      createdAt = Time.now();
      reminderEnabled;
      reminderOffset;
    };

    let userRoutines = getUserRoutines(caller);
    userRoutines.add(routine.id, routine);
    nextRoutineId += 1;
    routine.id;
  };

  public query ({ caller }) func getRoutine(id : RoutineId) : async ?Routine {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view routines");
    };

    let userRoutines = getUserRoutines(caller);
    userRoutines.get(id);
  };

  public query ({ caller }) func getAllRoutines() : async [Routine] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view routines");
    };

    let userRoutines = getUserRoutines(caller);
    let routinesArray = userRoutines.values().toArray();
    routinesArray.sort(
      func(r1 : Routine, r2 : Routine) : Order.Order {
        Nat.compare(r1.id, r2.id);
      },
    );
  };

  public shared ({ caller }) func updateRoutine(id : RoutineId, updates : RoutineUpdate) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update routines");
    };

    let userRoutines = getUserRoutines(caller);
    switch (userRoutines.get(id)) {
      case (null) { Runtime.trap("Routine not found") };
      case (?routine) {
        let updatedRoutine : Routine = {
          routine with
          name = switch (updates.name) { case (null) { routine.name }; case (?n) { n } };
          description = switch (updates.description) { case (null) { routine.description }; case (?d) { d } };
          scheduledTime = switch (updates.scheduledTime) { case (null) { routine.scheduledTime }; case (?t) { t } };
          repeatDays = switch (updates.repeatDays) { case (null) { routine.repeatDays }; case (?r) { r } };
          reminderEnabled = switch (updates.reminderEnabled) { case (null) { routine.reminderEnabled }; case (?r) { r } };
          reminderOffset = switch (updates.reminderOffset) { case (null) { routine.reminderOffset }; case (?r) { r } };
        };
        userRoutines.add(id, updatedRoutine);
      };
    };
  };

  public shared ({ caller }) func deleteRoutine(id : RoutineId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete routines");
    };

    let userRoutines = getUserRoutines(caller);
    userRoutines.remove(id);
  };

  // Routine Log Functions
  public shared ({ caller }) func logRoutine(routineId : RoutineId, date : Text, status : Text) : async LogId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can log routines");
    };

    let userRoutines = getUserRoutines(caller);
    switch (userRoutines.get(routineId)) {
      case (null) { Runtime.trap("Routine not found") };
      case (?_) {
        let log : RoutineLog = {
          id = nextLogId;
          routineId;
          date;
          status;
          loggedAt = Time.now();
        };

        let userLogs = getUserRoutineLogs(caller);
        userLogs.add(log.id, log);
        routineLogs.add(caller, userLogs);

        nextLogId += 1;
        log.id;
      };
    };
  };

  public shared ({ caller }) func updateRoutineLogStatus(routineId : RoutineId, date : Text, newStatus : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update routine logs");
    };

    let userRoutines = getUserRoutines(caller);
    switch (userRoutines.get(routineId)) {
      case (null) { Runtime.trap("Routine not found") };
      case (?_) {
        let userLogs = getUserRoutineLogs(caller);

        let logsArray = userLogs.values().toArray();

        // Find the most recent log for the given routineId and date.
        let matchingLog = logsArray.foldLeft<RoutineLog, ?RoutineLog>(
          null,
          func(current, log) {
            if (log.routineId == routineId and log.date == date) {
              switch (current) {
                case (null) { ?log };
                case (?existingLog) {
                  if (log.loggedAt > existingLog.loggedAt) {
                    ?log;
                  } else {
                    current;
                  };
                };
              };
            } else {
              current;
            };
          },
        );

        switch (matchingLog) {
          case (null) {
            // No matching log found, create a new one.
            let newLog : RoutineLog = {
              id = nextLogId;
              routineId;
              date;
              status = newStatus;
              loggedAt = Time.now();
            };
            userLogs.add(newLog.id, newLog);
            routineLogs.add(caller, userLogs);
            nextLogId += 1;
          };
          case (?existingLog) {
            // Update the existing log
            let updatedLog : RoutineLog = {
              existingLog with
              status = newStatus;
              loggedAt = Time.now();
            };

            userLogs.add(existingLog.id, updatedLog);
            routineLogs.add(caller, userLogs);
          };
        };
      };
    };
  };

  public query ({ caller }) func getRoutineLogs(routineId : RoutineId) : async [RoutineLog] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view routine logs");
    };

    let userLogs = getUserRoutineLogs(caller);
    let logsArray = userLogs.values().toArray();
    logsArray.filter<RoutineLog>(
      func(log) { log.routineId == routineId },
    );
  };

  public query ({ caller }) func getDailyRoutinesWithStatus(date : Text) : async [DailyRoutineStatus] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view daily routines");
    };

    let userRoutines = getUserRoutines(caller);
    let userLogs = getUserRoutineLogs(caller);

    let routinesArray = userRoutines.values().toArray();

    routinesArray.map<Routine, DailyRoutineStatus>(
      func(routine) {
        let logsArray = userLogs.values().toArray();

        // Find the most recent log for this routine and the given date
        let mostRecentLog = logsArray.foldLeft<RoutineLog, ?RoutineLog>(
          null,
          func(current, log) {
            if (log.routineId == routine.id and log.date == date) {
              switch (current) {
                case (null) { ?log };
                case (?existingLog) {
                  if (log.loggedAt > existingLog.loggedAt) {
                    ?log;
                  } else {
                    current;
                  };
                };
              };
            } else {
              current;
            };
          },
        );

        {
          routine;
          status = switch (mostRecentLog) {
            case (null) { null };
            case (?l) { ?l.status };
          };
        };
      },
    );
  };
};
